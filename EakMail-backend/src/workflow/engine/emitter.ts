/**
 * Redis-backed event emitter. Publishes `WsEvent` payloads to both the per-execution
 * channel and the global fan-out channel so the dashboard WebSocket bridge can relay
 * them (ARCHITECTURE.md §9). Implements the frozen `EventEmitter` seam plus the extra
 * lifecycle events the interpreter needs.
 *
 * Time is injected via a `now` provider so nothing calls `Date.now()` at module scope,
 * keeping the class deterministic under test.
 */
import type { Redis } from 'ioredis';
import type {
  ExecutionState,
  StepStatus,
  WsEvent,
} from '@eakmail/shared-types';
import { WsEventType as WsEventTypes } from '@eakmail/shared-types';
import { executionChannel, GLOBAL_EXECUTION_CHANNEL } from '../../lib/redis.js';
import type { EventEmitter } from './node-executor.js';

/** Minimal publisher surface (ioredis `publish`), narrowed for testability. */
export interface Publisher {
  publish(channel: string, message: string): unknown;
}

export type NowProvider = () => number;

/** Distributive Omit so each WsEvent variant keeps its own discriminated fields. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

/** A WsEvent payload with the emitter-stamped base fields removed. */
type WsEventInput = DistributiveOmit<WsEvent, 'executionId' | 'ts'>;

/**
 * Emits execution events to Redis. Satisfies the `EventEmitter` node-executor seam and
 * additionally exposes lifecycle emitters (started/state/step/finished) for the interpreter.
 */
export class RedisEventEmitter implements EventEmitter {
  constructor(
    private readonly redis: Publisher,
    private readonly executionId: string,
    private readonly now: NowProvider,
  ) {}

  // ---- node-executor EventEmitter seam --------------------------------------

  messageSent(nodeId: string, text: string): void {
    this.publish({ type: WsEventTypes.MESSAGE_SENT, nodeId, text });
  }

  messageReceived(nodeId: string | null, text: string): void {
    this.publish({ type: WsEventTypes.MESSAGE_RECEIVED, nodeId, text });
  }

  variableSet(name: string, value: unknown): void {
    this.publish({ type: WsEventTypes.VARIABLE_SET, name, value });
  }

  log(level: 'info' | 'warn' | 'error', message: string): void {
    this.publish({ type: WsEventTypes.LOG, level, message });
  }

  // ---- lifecycle events (interpreter) ---------------------------------------

  executionStarted(workflowId: string, orderId: string | null): void {
    this.publish({ type: WsEventTypes.EXECUTION_STARTED, workflowId, orderId });
  }

  executionState(state: ExecutionState): void {
    this.publish({ type: WsEventTypes.EXECUTION_STATE, state });
  }

  stepEntered(nodeId: string, nodeType: string, input: unknown): void {
    this.publish({ type: WsEventTypes.STEP_ENTERED, nodeId, nodeType, input });
  }

  stepExited(params: {
    nodeId: string;
    nodeType: string;
    status: StepStatus;
    output: unknown;
    error: string | null;
    outPort: string | null;
    durationMs: number;
  }): void {
    this.publish({ type: WsEventTypes.STEP_EXITED, ...params });
  }

  executionFinished(state: ExecutionState): void {
    this.publish({ type: WsEventTypes.EXECUTION_FINISHED, state });
  }

  // ---- internals ------------------------------------------------------------

  /** Stamp the base fields and publish to both channels. */
  private publish(partial: WsEventInput): void {
    const event = {
      ...partial,
      executionId: this.executionId,
      ts: this.now(),
    } as WsEvent;
    const message = JSON.stringify(event);
    this.redis.publish(executionChannel(this.executionId), message);
    this.redis.publish(GLOBAL_EXECUTION_CHANNEL, message);
  }
}

/** Factory using a real ioredis connection. */
export function createEmitter(
  redis: Redis,
  executionId: string,
  now: NowProvider = Date.now,
): RedisEventEmitter {
  return new RedisEventEmitter(redis, executionId, now);
}
