/**
 * WebSocket event payloads — backend → frontend live stream (ARCHITECTURE.md §9).
 * Used by live monitoring and workflow test mode (BLUEPRINT.md §10).
 * These are also the Redis pub/sub payload shapes the engine emits.
 */
import type { ExecutionState, StepStatus } from './enums.js';

export const WsEventType = {
  EXECUTION_STARTED: 'execution.started',
  EXECUTION_STATE: 'execution.state',
  STEP_ENTERED: 'execution.step.entered',
  STEP_EXITED: 'execution.step.exited',
  MESSAGE_SENT: 'execution.message.sent',
  MESSAGE_RECEIVED: 'execution.message.received',
  VARIABLE_SET: 'execution.variable.set',
  LOG: 'execution.log',
  EXECUTION_FINISHED: 'execution.finished',
} as const;
export type WsEventType = (typeof WsEventType)[keyof typeof WsEventType];

export interface WsBaseEvent {
  type: WsEventType;
  executionId: string;
  /** Milliseconds since epoch, stamped by the emitter. */
  ts: number;
}

export interface ExecutionStartedEvent extends WsBaseEvent {
  type: typeof WsEventType.EXECUTION_STARTED;
  workflowId: string;
  orderId: string | null;
}
export interface ExecutionStateEvent extends WsBaseEvent {
  type: typeof WsEventType.EXECUTION_STATE;
  state: ExecutionState;
}
export interface StepEnteredEvent extends WsBaseEvent {
  type: typeof WsEventType.STEP_ENTERED;
  nodeId: string;
  nodeType: string;
  input: unknown;
}
export interface StepExitedEvent extends WsBaseEvent {
  type: typeof WsEventType.STEP_EXITED;
  nodeId: string;
  nodeType: string;
  status: StepStatus;
  output: unknown;
  error: string | null;
  outPort: string | null;
  durationMs: number;
}
export interface MessageSentEvent extends WsBaseEvent {
  type: typeof WsEventType.MESSAGE_SENT;
  nodeId: string;
  text: string;
}
export interface MessageReceivedEvent extends WsBaseEvent {
  type: typeof WsEventType.MESSAGE_RECEIVED;
  nodeId: string | null;
  text: string;
}
export interface VariableSetEvent extends WsBaseEvent {
  type: typeof WsEventType.VARIABLE_SET;
  name: string;
  value: unknown;
}
export interface LogEvent extends WsBaseEvent {
  type: typeof WsEventType.LOG;
  level: 'info' | 'warn' | 'error';
  message: string;
}
export interface ExecutionFinishedEvent extends WsBaseEvent {
  type: typeof WsEventType.EXECUTION_FINISHED;
  state: ExecutionState;
}

export type WsEvent =
  | ExecutionStartedEvent
  | ExecutionStateEvent
  | StepEnteredEvent
  | StepExitedEvent
  | MessageSentEvent
  | MessageReceivedEvent
  | VariableSetEvent
  | LogEvent
  | ExecutionFinishedEvent;

/** Client → server subscription message. */
export interface WsSubscribe {
  action: 'subscribe' | 'unsubscribe';
  executionId: string;
}
