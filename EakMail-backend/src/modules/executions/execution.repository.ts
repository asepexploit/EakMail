/**
 * Execution data access (Prisma). No HTTP, no business rules (backend-guide.md §2).
 * Reads Execution rows for the dashboard list/detail views; the engine itself writes
 * executions/steps through the interpreter's persistence seam, not through here.
 */
import type { Execution, ExecutionStep } from '@prisma/client';
import { prisma } from '../../db/client.js';

export type { Execution, ExecutionStep };

/** An execution together with its ordered step log (detail view). */
export type ExecutionWithSteps = Execution & { steps: ExecutionStep[] };

export function findAll(): Promise<Execution[]> {
  return prisma.execution.findMany({ orderBy: { createdAt: 'desc' } });
}

export function findById(id: string): Promise<Execution | null> {
  return prisma.execution.findUnique({ where: { id } });
}

/** Execution with steps ordered oldest-first so the UI can replay the run. */
export function findByIdWithSteps(id: string): Promise<ExecutionWithSteps | null> {
  return prisma.execution.findUnique({
    where: { id },
    include: { steps: { orderBy: { ts: 'asc' } } },
  });
}

/**
 * Force an execution to CANCELLED, but only from a non-terminal state, and only when it
 * is not already finished. Returns the number of rows changed (1 = we cancelled it, 0 =
 * it was already terminal/running-and-handled-elsewhere). Used when a CANCEL command
 * arrives for a run that no live interpreter is listening to (still PENDING/PAUSED).
 */
export async function cancelIfPending(id: string): Promise<number> {
  const result = await prisma.execution.updateMany({
    where: { id, state: { in: ['PENDING', 'PAUSED'] } },
    data: { state: 'CANCELLED', finishedAt: new Date() },
  });
  return result.count;
}

/** Create a queued (PENDING) execution row; the worker/engine advances it from here. */
export function createPending(data: {
  workflowId: string;
  orderId: string | null;
  accountId: string | null;
  mode: 'PRODUCTION' | 'TEST';
  variables: Record<string, string>;
}): Promise<Execution> {
  return prisma.execution.create({
    data: {
      workflowId: data.workflowId,
      orderId: data.orderId,
      accountId: data.accountId,
      mode: data.mode,
      state: 'PENDING',
      variables: data.variables,
    },
  });
}
