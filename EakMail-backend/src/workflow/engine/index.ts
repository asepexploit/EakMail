/**
 * Public surface of the Workflow Engine.
 *
 * Consumers (the workflow-run worker, test-mode runner) import from here:
 *  - `runExecution` + types for the low-level interpreter.
 *  - `RedisEventEmitter` / `createEmitter` for live events.
 *  - `RedisExecutionControl` for pause/resume/cancel.
 *  - `StepPersistence` for the DB seam, and `getExecutor` for direct node access.
 */
export type {
  ExecutionContext,
  EventEmitter,
  NodeExecutor,
  NodeResult,
} from './node-executor.js';

export {
  runExecution,
  NOOP_CONTROL,
} from './interpreter.js';
export type {
  InterpreterDeps,
  ExecutionResult,
  ExecutionControl,
  ControlDecision,
} from './interpreter.js';

export { RedisEventEmitter, createEmitter } from './emitter.js';
export type { NowProvider, Publisher } from './emitter.js';

export { RedisExecutionControl } from './control.js';

export { StepPersistence } from './persistence.js';
export type { ExecutionStore } from './persistence.js';

export { GraphIndex } from './graph.js';

export { getExecutor } from '../registry.js';

export { renderTemplate, renderValue, resolvePath } from '../variables.js';
export { evaluateExpression, evaluateSwitchValue } from '../expression.js';
