/**
 * Workflow data access (Prisma). No HTTP, no business rules.
 *
 * Versioning model (schema.prisma Workflow/WorkflowVersion):
 *  - `workflow.version` is the current version number.
 *  - each save snapshots the *new* graph into WorkflowVersion and bumps `version`.
 *  - rollback copies a historical snapshot back onto the workflow as a new version.
 * All multi-step writes run in a transaction to keep version + snapshot in sync.
 */
import type { Prisma, Workflow, WorkflowVersion } from '@prisma/client';
import { prisma } from '../../db/client.js';

export type { Workflow, WorkflowVersion };

export interface CreateWorkflowData {
  name: string;
  supplierId: string | null;
  graph: Prisma.InputJsonValue;
  isActive: boolean;
}

export interface UpdateWorkflowData {
  name: string;
  supplierId: string | null;
  graph: Prisma.InputJsonValue;
  isActive: boolean;
}

export function findAll(): Promise<Workflow[]> {
  return prisma.workflow.findMany({ orderBy: { updatedAt: 'desc' } });
}

export function findById(id: string): Promise<Workflow | null> {
  return prisma.workflow.findUnique({ where: { id } });
}

export function findVersion(workflowId: string, version: number): Promise<WorkflowVersion | null> {
  return prisma.workflowVersion.findFirst({ where: { workflowId, version } });
}

export function listVersions(workflowId: string): Promise<WorkflowVersion[]> {
  return prisma.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { version: 'desc' },
  });
}

/** Create a workflow at version 1 and snapshot its initial graph. */
export function create(data: CreateWorkflowData): Promise<Workflow> {
  return prisma.workflow.create({
    data: {
      name: data.name,
      supplierId: data.supplierId,
      graph: data.graph,
      isActive: data.isActive,
      version: 1,
      versionsHistory: {
        create: { graph: data.graph, version: 1 },
      },
    },
  });
}

/**
 * Save an edit: bump the version, persist the new graph, and snapshot it into
 * WorkflowVersion — atomically.
 */
export function saveNewVersion(
  id: string,
  currentVersion: number,
  data: UpdateWorkflowData,
): Promise<Workflow> {
  const nextVersion = currentVersion + 1;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workflow.update({
      where: { id },
      data: {
        name: data.name,
        supplierId: data.supplierId,
        graph: data.graph,
        isActive: data.isActive,
        version: nextVersion,
      },
    });
    await tx.workflowVersion.create({
      data: { workflowId: id, graph: data.graph, version: nextVersion },
    });
    return updated;
  });
}

/**
 * Roll the workflow's live graph back to a historical snapshot, recorded as a
 * fresh version (history is append-only; we never rewind the counter).
 */
export function rollbackToVersion(
  id: string,
  currentVersion: number,
  snapshotGraph: Prisma.InputJsonValue,
): Promise<Workflow> {
  const nextVersion = currentVersion + 1;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workflow.update({
      where: { id },
      data: { graph: snapshotGraph, version: nextVersion },
    });
    await tx.workflowVersion.create({
      data: { workflowId: id, graph: snapshotGraph, version: nextVersion },
    });
    return updated;
  });
}

export function setActive(id: string, isActive: boolean): Promise<Workflow> {
  return prisma.workflow.update({ where: { id }, data: { isActive } });
}

export function remove(id: string): Promise<void> {
  return prisma.workflow.delete({ where: { id } }).then(() => undefined);
}
