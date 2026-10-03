/**
 * The workflow interpreter: traverses a WorkflowGraph from START, following outPort edges,
 * running each node's executor, persisting an ExecutionStep before/after, emitting live
 * events, and checkpointing state so the run is resumable after a restart.
 *
 * Cooperative control:
 *  - `deps.signal` (AbortSignal) cancels the run between/within nodes.
 *  - `deps.control` is polled before each node: it can PAUSE (block until resumed/cancelled)
 *    or CANCEL the run. This is how BLUEPRINT §10.3 live controls reach the engine.
 *
 * The interpreter is intentionally split into small helpers (advance, runNode, persistStep).
 */
import type {
  WorkflowGraph,
  WorkflowNode,
  ExecutionState,
  StepStatus,
} from '@eakmail/shared-types';
import { ExecutionState as States } from '@eakmail/shared-types';
import type { TelegramConversation } from '../../telegram/session-manager/types.js';
import { WorkflowError } from '../../lib/errors.js';
import { getExecutor } from '../registry.js';
import { renderTemplate } from '../variables.js';
import type { ExecutionContext, NodeResult } from './node-executor.js';
import type { RedisEventEmitter } from './emitter.js';
import { GraphIndex } from './graph.js';
import { StepPersistence } from './persistence.js';
import { AbortedError } from '../nodes/helpers.js';

/** Live control decision polled before each node. */
export type ControlDecision = 'continue' | 'pause' | 'cancel' | 'step';

/**
 * Async control checker. Called before each node with the upcoming node id.
 * Implementations poll the Redis command channel. Returning 'pause' makes the interpreter
 * persist PAUSED and keep polling (via `awaitResume`) until 'continue'/'step'/'cancel'.
 */
export interface ExecutionControl {
  /** Decide what to do before the next node runs. */
  check(nextNodeId: string): Promise<ControlDecision>;
  /** Block while paused; resolves with the next decision once a command arrives. */
  awaitResume(): Promise<ControlDecision>;
}

/** A control that never intervenes (used by test mode / simple runs). */
export const NOOP_CONTROL: ExecutionControl = {
  async check() {
    return 'continue';
  },
  async awaitResume() {
    return 'continue';
  },
};

export interface InterpreterDeps {
  executionId: string;
  graph: WorkflowGraph;
  /** Initial variables (order context + workflow defaults). Mutated in place during the run. */
  variables: Record<string, unknown>;
  conversation: TelegramConversation | null;
  /** API supplier credentials (null for BOT-type suppliers). */
  apiSupplier?: { baseUrl: string; apiKeyEnc: string; authHeader: string | null } | null;
  emitter: RedisEventEmitter;
  persistence: StepPersistence;
  signal: AbortSignal;
  control?: ExecutionControl;
  /** Optional starting node id for resume/retry-from-node (defaults to START). */
  startNodeId?: string;
  workflowId: string;
  orderId: string | null;
}

export interface ExecutionResult {
  state: ExecutionState;
  terminal: NodeResult['terminal'] | null;
  variables: Record<string, unknown>;
  lastNodeId: string | null;
}

/** Guard against pathological cycles that never reach a terminal node. */
const MAX_STEPS = 10_000;

/**
 * Run an execution to completion (or until cancelled/paused-then-cancelled).
 * Returns the final state, terminal payload, and variables.
 */
export async function runExecution(deps: InterpreterDeps): Promise<ExecutionResult> {
  const index = new GraphIndex(deps.graph);
  const control = deps.control ?? NOOP_CONTROL;
  const ctx = buildContext(deps);

  await deps.persistence.markStarted(deps.executionId);
  deps.emitter.executionStarted(deps.workflowId, deps.orderId);
  deps.emitter.executionState(States.RUNNING);

  let currentId: string | null = deps.startNodeId ?? index.findStart().id;
  let lastNodeId: string | null = null;
  let steps = 0;

  try {
    while (currentId != null) {
      if (steps++ > MAX_STEPS) {
        throw new WorkflowError(`Execution exceeded ${MAX_STEPS} steps (possible infinite loop)`);
      }

      // Live control + cancellation gate before each node.
      const gate = await applyControl(deps, control, currentId);
      if (gate === 'cancel') {
        return await finish(deps, States.CANCELLED, null, lastNodeId);
      }
      throwIfAborted(deps.signal);

      const node = index.getNode(currentId);
      const result = await runNode(deps, ctx, node);
      lastNodeId = currentId;

      // Checkpoint variables after every node so resume picks up exactly here.
      await deps.persistence.updateState(deps.executionId, States.RUNNING, deps.variables);

      if (result.terminal) {
        const finalState =
          result.terminal.kind === 'success' ? States.SUCCEEDED : States.FAILED;
        return await finish(deps, finalState, result.terminal, currentId);
      }

      currentId = index.nextNodeId(currentId, result.outPort);
    }

    // Ran off the end of the graph without a terminal node → treat as success.
    return await finish(deps, States.SUCCEEDED, null, lastNodeId);
  } catch (err) {
    if (err instanceof AbortedError) {
      return await finish(deps, States.CANCELLED, null, lastNodeId);
    }
    const message = err instanceof Error ? err.message : String(err);
    deps.emitter.log('error', `Execution error: ${message}`);
    return await finish(deps, States.FAILED, { kind: 'fail', reason: message }, lastNodeId);
  }
}

// ---- helpers ----------------------------------------------------------------

/** Build the per-execution ExecutionContext handed to every node. */
function buildContext(deps: InterpreterDeps): ExecutionContext {
  return {
    executionId: deps.executionId,
    variables: deps.variables,
    conversation: deps.conversation,
    apiSupplier: deps.apiSupplier ?? null,
    emitter: deps.emitter,
    render: (template: string) => renderTemplate(template, deps.variables),
    signal: deps.signal,
  };
}

/**
 * Poll the control checker; if paused, persist PAUSED, emit the state, and block on
 * `awaitResume` until told to continue/step/cancel. Returns the resolved decision.
 */
async function applyControl(
  deps: InterpreterDeps,
  control: ExecutionControl,
  nextNodeId: string,
): Promise<ControlDecision> {
  let decision = await control.check(nextNodeId);
  if (decision === 'pause') {
    await deps.persistence.updateState(deps.executionId, States.PAUSED, deps.variables);
    deps.emitter.executionState(States.PAUSED);
    decision = await control.awaitResume();
    if (decision !== 'cancel') {
      await deps.persistence.updateState(deps.executionId, States.RUNNING, deps.variables);
      deps.emitter.executionState(States.RUNNING);
    }
  }
  return decision;
}

/** Run one node: persist entered, execute, persist exited, emit events. */
async function runNode(
  deps: InterpreterDeps,
  ctx: ExecutionContext,
  node: WorkflowNode,
): Promise<NodeResult> {
  const started = Date.now();
  deps.emitter.stepEntered(node.id, node.type, node.config);
  await deps.persistence.stepEntered({
    executionId: deps.executionId,
    nodeId: node.id,
    nodeType: node.type,
    input: node.config,
  });

  const timeoutMs = node.config.timeoutMs;
  try {
    const executor = getExecutor(node.type);
    const result = timeoutMs
      ? await withNodeTimeout(executor.execute(node, ctx), timeoutMs, node.id, deps.signal)
      : await executor.execute(node, ctx);

    const isTerminalFail = result.terminal?.kind === 'fail';
    const status: StepStatus = isTerminalFail ? 'FAILED' : 'SUCCEEDED';
    // When a node intentionally terminates with FAIL, surface its reason in the step's `error`
    // column so the dashboard "last error" shows something useful (otherwise it would be blank).
    const stepError = isTerminalFail ? (result.terminal?.reason ?? null) : null;
    await persistExit(deps, node, status, result.output, stepError, result.outPort, started);
    return result;
  } catch (err) {
    const isTimeout = err instanceof NodeTimeoutError;
    const status: StepStatus = isTimeout ? 'TIMED_OUT' : 'FAILED';
    const message = err instanceof Error ? err.message : String(err);
    await persistExit(deps, node, status, null, message, null, started);
    throw err;
  }
}

/** Persist a step exit + emit the paired event. */
async function persistExit(
  deps: InterpreterDeps,
  node: WorkflowNode,
  status: StepStatus,
  output: unknown,
  error: string | null,
  outPort: string | null,
  startedAt: number,
): Promise<void> {
  await deps.persistence.stepExited({
    executionId: deps.executionId,
    nodeId: node.id,
    nodeType: node.type,
    status,
    output,
    error,
    outPort,
  });
  deps.emitter.stepExited({
    nodeId: node.id,
    nodeType: node.type,
    status,
    output,
    error,
    outPort,
    durationMs: Date.now() - startedAt,
  });
}

/** Finalize the execution: persist final state, emit finished, return the result. */
async function finish(
  deps: InterpreterDeps,
  state: ExecutionState,
  terminal: NodeResult['terminal'] | null,
  lastNodeId: string | null,
): Promise<ExecutionResult> {
  await deps.persistence.markFinished(deps.executionId, state, deps.variables);
  deps.emitter.executionState(state);
  deps.emitter.executionFinished(state);
  return { state, terminal: terminal ?? null, variables: deps.variables, lastNodeId };
}

// ---- node-level timeout -----------------------------------------------------

class NodeTimeoutError extends WorkflowError {
  constructor(nodeId: string, ms: number) {
    super(`Node ${nodeId} timed out after ${ms}ms`, nodeId);
    this.name = 'NodeTimeoutError';
  }
}

/** Race a node's execution against its per-node timeout. */
function withNodeTimeout<T>(
  promise: Promise<T>,
  ms: number,
  nodeId: string,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NodeTimeoutError(nodeId, ms)), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AbortedError();
}
