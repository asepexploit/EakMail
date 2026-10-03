/**
 * Persistence seam for the interpreter: writes ExecutionStep rows, updates Execution
 * state/variables, and stamps timestamps. Narrowed to the exact Prisma calls used so the
 * interpreter can be unit-tested with an in-memory fake. All writes are best-effort logged
 * by the caller; this module only performs them.
 */
import type { ExecutionState, StepStatus } from '@eakmail/shared-types';

/** The subset of PrismaClient the interpreter depends on. */
export interface ExecutionStore {
  execution: {
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  executionStep: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export interface StepEnteredRecord {
  executionId: string;
  nodeId: string;
  nodeType: string;
  input: unknown;
}

export interface StepExitedRecord {
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: StepStatus;
  output: unknown;
  error: string | null;
  outPort: string | null;
}

/** Persistence operations, isolated from the traversal logic. */
export class StepPersistence {
  constructor(private readonly store: ExecutionStore) {}

  /** Record a node being entered (RUNNING). Returns the created step id. */
  async stepEntered(rec: StepEnteredRecord): Promise<string> {
    const step = await this.store.executionStep.create({
      data: {
        executionId: rec.executionId,
        nodeId: rec.nodeId,
        nodeType: rec.nodeType,
        status: 'RUNNING',
        input: toJson(rec.input),
      },
    });
    return step.id;
  }

  /** Record a node exit (final status + output + chosen port). */
  async stepExited(rec: StepExitedRecord): Promise<void> {
    await this.store.executionStep.create({
      data: {
        executionId: rec.executionId,
        nodeId: rec.nodeId,
        nodeType: rec.nodeType,
        status: rec.status,
        output: toJson(rec.output),
        error: rec.error,
        outPort: rec.outPort,
      },
    });
  }

  /** Persist the current state and (checkpointed) variables. */
  async updateState(
    executionId: string,
    state: ExecutionState,
    variables: Record<string, unknown>,
  ): Promise<void> {
    await this.store.execution.update({
      where: { id: executionId },
      data: { state, variables: toJson(variables) },
    });
  }

  async markStarted(executionId: string): Promise<void> {
    await this.store.execution.update({
      where: { id: executionId },
      data: { state: 'RUNNING', startedAt: new Date() },
    });
  }

  async markFinished(
    executionId: string,
    state: ExecutionState,
    variables: Record<string, unknown>,
  ): Promise<void> {
    await this.store.execution.update({
      where: { id: executionId },
      data: { state, variables: toJson(variables), finishedAt: new Date() },
    });
  }
}

/** Ensure we only hand Prisma JSON-serializable values (drops undefined, functions). */
function toJson(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}
