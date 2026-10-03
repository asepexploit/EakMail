/**
 * Prisma Execution/ExecutionStep → wire DTO mappers (ARCHITECTURE.md §6, dto.ts).
 * Pure, no I/O. Keeps the shaping logic out of the service and route layers.
 */
import type {
  ExecutionDetailDto,
  ExecutionDto,
  ExecutionMode,
  ExecutionState,
  ExecutionStepDto,
  StepStatus,
} from '@eakmail/shared-types';
import type { Execution, ExecutionStep, ExecutionWithSteps } from './execution.repository.js';

/** Stored `variables` JSON conforms to ExecutionVariables (Record<string, unknown>). */
function readVariables(execution: Execution): Record<string, unknown> {
  const value = execution.variables;
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function toExecutionDto(execution: Execution): ExecutionDto {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    orderId: execution.orderId,
    mode: execution.mode as ExecutionMode,
    state: execution.state as ExecutionState,
    variables: readVariables(execution),
    startedAt: execution.startedAt ? execution.startedAt.toISOString() : null,
    finishedAt: execution.finishedAt ? execution.finishedAt.toISOString() : null,
  };
}

function toStepDto(step: ExecutionStep): ExecutionStepDto {
  return {
    id: step.id,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    status: step.status as StepStatus,
    input: step.input ?? null,
    output: step.output ?? null,
    error: step.error,
    ts: step.ts.toISOString(),
  };
}

export function toExecutionDetailDto(execution: ExecutionWithSteps): ExecutionDetailDto {
  return {
    ...toExecutionDto(execution),
    steps: execution.steps.map(toStepDto),
  };
}
