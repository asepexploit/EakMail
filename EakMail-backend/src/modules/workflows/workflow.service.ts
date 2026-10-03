/**
 * Workflow business logic: CRUD with graph validation, versioned saves, and
 * rollback. Refuses to activate an invalid graph. Takes/returns plain data.
 * See backend-guide.md §2, workflow-validator.ts for the validation rules.
 */
import type {
  UpsertWorkflowRequest,
  WorkflowDto,
  WorkflowGraph,
  WorkflowValidationResult,
} from '@eakmail/shared-types';
import type { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import * as repository from './workflow.repository.js';
import type { Workflow } from './workflow.repository.js';
import { validateWorkflowGraph } from './workflow-validator.js';

/** The stored `graph` column is JSON; it conforms to the WorkflowGraph contract. */
function readGraph(workflow: Workflow): WorkflowGraph {
  return workflow.graph as unknown as WorkflowGraph;
}

/** Narrow a WorkflowGraph to the Prisma JSON input type for writes. */
function toJson(graph: WorkflowGraph): Prisma.InputJsonValue {
  return graph as unknown as Prisma.InputJsonValue;
}

function toDto(workflow: Workflow): WorkflowDto {
  return {
    id: workflow.id,
    name: workflow.name,
    supplierId: workflow.supplierId,
    graph: readGraph(workflow),
    version: workflow.version,
    isActive: workflow.isActive,
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

/**
 * A workflow may only be activated with a valid graph. Throws with the first
 * error message when activation is requested on an invalid graph.
 */
function assertActivatable(isActive: boolean, result: WorkflowValidationResult): void {
  if (!isActive) return;
  if (!result.valid) {
    const firstError = result.issues.find((issue) => issue.severity === 'error');
    throw new ValidationError(
      `Cannot activate an invalid workflow: ${firstError?.message ?? 'graph is invalid'}`,
    );
  }
}

export async function listWorkflows(): Promise<WorkflowDto[]> {
  const records = await repository.findAll();
  return records.map(toDto);
}

export async function getWorkflow(id: string): Promise<WorkflowDto> {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Workflow');
  return toDto(record);
}

export async function createWorkflow(input: UpsertWorkflowRequest): Promise<WorkflowDto> {
  const isActive = input.isActive ?? false;
  assertActivatable(isActive, validateWorkflowGraph(input.graph));
  const record = await repository.create({
    name: input.name,
    supplierId: input.supplierId ?? null,
    graph: toJson(input.graph),
    isActive,
  });
  return toDto(record);
}

/** Save an edit as a new version (bumps version, snapshots the graph). */
export async function updateWorkflow(
  id: string,
  input: UpsertWorkflowRequest,
): Promise<WorkflowDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Workflow');
  const isActive = input.isActive ?? existing.isActive;
  assertActivatable(isActive, validateWorkflowGraph(input.graph));
  const record = await repository.saveNewVersion(id, existing.version, {
    name: input.name,
    supplierId: input.supplierId ?? null,
    graph: toJson(input.graph),
    isActive,
  });
  return toDto(record);
}

/** Toggle isActive without requiring the full graph payload. */
export async function toggleActive(id: string, isActive: boolean): Promise<WorkflowDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Workflow');
  if (isActive) {
    assertActivatable(true, validateWorkflowGraph(readGraph(existing)));
  }
  const record = await repository.setActive(id, isActive);
  return toDto(record);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Workflow');
  await repository.remove(id);
}

/** Validate the currently-stored graph for a workflow. */
export async function validateWorkflow(id: string): Promise<WorkflowValidationResult> {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Workflow');
  return validateWorkflowGraph(readGraph(record));
}

/** Roll a workflow's live graph back to a historical version snapshot. */
export async function rollbackWorkflow(id: string, targetVersion: number): Promise<WorkflowDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Workflow');
  if (targetVersion === existing.version) {
    throw new ValidationError('Workflow is already at the requested version.');
  }
  const snapshot = await repository.findVersion(id, targetVersion);
  if (!snapshot) throw new NotFoundError(`Workflow version ${targetVersion}`);
  const record = await repository.rollbackToVersion(
    id,
    existing.version,
    snapshot.graph as Prisma.InputJsonValue,
  );
  return toDto(record);
}
