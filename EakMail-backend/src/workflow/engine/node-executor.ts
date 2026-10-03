/**
 * Node executor contract — FROZEN seam between the engine and each node executor file.
 * One executor per node type lives in ../nodes/<node-name>.node.ts and is registered
 * in ../registry.ts (no switch). See .claude/instructions/adding-a-node.md, BLUEPRINT.md §8.
 */
import type { NodeType, WorkflowNode } from '@eakmail/shared-types';
import type { TelegramConversation } from '../../telegram/session-manager/types.js';

/** Emit a live event to the dashboard (wraps Redis pub/sub). */
export interface EventEmitter {
  messageSent(nodeId: string, text: string): void;
  messageReceived(nodeId: string | null, text: string): void;
  variableSet(name: string, value: unknown): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

/** API supplier credentials passed through context (never logged). */
export interface ApiSupplierContext {
  baseUrl: string;
  apiKeyEnc: string;
  authHeader: string | null;
}

/** Runtime context passed to every node executor. */
export interface ExecutionContext {
  executionId: string;
  /** Mutable variable bag; EXTRACT_DATA/SET_VARIABLE write here, templating reads it. */
  variables: Record<string, unknown>;
  /** Telegram conversation to the supplier (null in some test scenarios). */
  conversation: TelegramConversation | null;
  /** API supplier config (null for BOT-type suppliers). */
  apiSupplier: ApiSupplierContext | null;
  emitter: EventEmitter;
  /** Resolve {{var}} templates against `variables`. Provided by the engine. */
  render(template: string): string;
  /** Cooperative cancellation — executors should check between awaits. */
  signal: AbortSignal;
}

/** What an executor returns to the engine to decide the next edge to follow. */
export interface NodeResult {
  /** Output port to follow (must be one of NODE_OUTPUT_PORTS[nodeType]). */
  outPort: string;
  /** Structured output recorded in the step log. */
  output?: unknown;
  /** Terminal signal for SUCCESS/FAIL/DELIVER nodes. */
  terminal?: {
    kind: 'success' | 'fail';
    reason?: string;
    payload?: unknown;
    refund?: boolean;
  };
}

/** A single node's executor. */
export interface NodeExecutor<T extends NodeType = NodeType> {
  readonly type: T;
  execute(node: WorkflowNode<T>, ctx: ExecutionContext): Promise<NodeResult>;
}
