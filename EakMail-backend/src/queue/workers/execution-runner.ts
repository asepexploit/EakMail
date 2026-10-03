/**
 * Runs one workflow execution end-to-end against the engine interpreter: creates the
 * Execution row, opens a Telegram conversation (mock or real via the frozen session-manager
 * seam), wires the Redis event emitter + step persistence, and returns the ExecutionResult.
 *
 * Shared by the order-fulfillment worker (mode PRODUCTION) and the workflow-run worker
 * (mode TEST). The interpreter itself is frozen — this file only assembles its deps.
 */
import type { ExecutionMode, WorkflowGraph } from '@eakmail/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { createRedis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import {
  createEmitter,
  RedisExecutionControl,
  runExecution,
  StepPersistence,
} from '../../workflow/engine/index.js';
import type { ExecutionResult } from '../../workflow/engine/index.js';
import { getSessionManager } from '../../telegram/session-manager/index.js';
import type { TelegramConversation } from '../../telegram/session-manager/types.js';

const log = logger.child({ module: 'execution-runner' });

export interface RunWorkflowInput {
  workflowId: string;
  graph: WorkflowGraph;
  orderId: string | null;
  accountId: string | null;
  /** Supplier bot @username to open a conversation to; null skips the conversation. */
  peer: string | null;
  mode: ExecutionMode;
  variables: Record<string, unknown>;
  /** External cancellation (e.g. job removed / shutdown). */
  signal: AbortSignal;
  /** Reuse an existing Execution row (retry) instead of creating a new one. */
  executionId?: string;
}

export interface RunWorkflowOutput {
  executionId: string;
  result: ExecutionResult;
}

/**
 * Create-or-reuse an Execution, open the conversation, run the interpreter, and clean up.
 * The caller decides what to do with the terminal result (persist Delivery, refund, …).
 */
export async function runWorkflowExecution(input: RunWorkflowInput): Promise<RunWorkflowOutput> {
  const executionId =
    input.executionId ?? (await createExecution(input));

  const pub = createRedis();
  // Attach error listener so ioredis "error" events (ECONNRESET, auth, etc.) don't crash the
  // worker process — the publish-only client has no retry queue of its own.
  pub.on('error', (err) => log.warn({ err, executionId }, 'execution-runner pub redis error'));

  const emitter = createEmitter(pub, executionId);
  const persistence = new StepPersistence(prisma);

  // Wire live controls (PAUSE/RESUME/STEP/CANCEL from the dashboard) by subscribing to the
  // per-execution command channel. Without this the interpreter runs with NOOP_CONTROL and
  // every live command the admin sends is silently dropped.
  const sub = createRedis();
  sub.on('error', (err) => log.warn({ err, executionId }, 'execution-runner sub redis error'));
  // Bridge an external AbortSignal into our local controller so CANCEL and parent-signal
  // sources both abort the same way.
  const abortController = new AbortController();
  if (input.signal.aborted) abortController.abort();
  else input.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  const control = new RedisExecutionControl(sub, executionId, abortController);
  await control.start();

  let conversation: TelegramConversation | null = null;
  try {
    if (input.peer && input.accountId) {
      conversation = await getSessionManager().openConversation(input.accountId, input.peer);
    }

    const result = await runExecution({
      executionId,
      graph: input.graph,
      variables: input.variables,
      conversation,
      emitter,
      persistence,
      control,
      signal: abortController.signal,
      workflowId: input.workflowId,
      orderId: input.orderId,
    });

    return { executionId, result };
  } finally {
    if (conversation) {
      await conversation.close().catch((err) => log.warn({ err }, 'conversation close failed'));
    }
    await control.stop().catch((err) => log.warn({ err }, 'control stop failed'));
    sub.disconnect();
    pub.disconnect();
  }
}

/** Insert the Execution row the interpreter will drive. */
async function createExecution(input: RunWorkflowInput): Promise<string> {
  const execution = await prisma.execution.create({
    data: {
      workflowId: input.workflowId,
      orderId: input.orderId,
      accountId: input.accountId,
      mode: input.mode,
      variables: toJson(input.variables),
    },
    select: { id: true },
  });
  return execution.id;
}

/** Ensure Prisma only receives JSON-serializable values (drops undefined/functions). */
function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
