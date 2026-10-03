/**
 * Execution business logic (backend-guide.md §2): dashboard reads, live control commands,
 * and starting a test run. Takes/returns plain data — no Fastify objects.
 *
 *  - list/get shape stored executions into DTOs.
 *  - sendCommand publishes an ExecutionCommand onto the per-execution Redis command channel;
 *    the running interpreter's RedisExecutionControl consumes it (BLUEPRINT.md §10.3).
 *  - runTest creates a PENDING TEST execution and enqueues a workflow-run job for it.
 */
import type {
  ExecutionCommand,
  ExecutionCommandRequest,
  ExecutionDetailDto,
  ExecutionDto,
  RunTestRequest,
} from '@eakmail/shared-types';
import { ExecutionCommand as Cmd, ExecutionState, WsEventType } from '@eakmail/shared-types';
import { NotFoundError } from '../../lib/errors.js';
import {
  redis,
  executionCommandChannel,
  executionChannel,
  GLOBAL_EXECUTION_CHANNEL,
} from '../../lib/redis.js';
import { getQueues, QueueName, type WorkflowRunJob } from '../../queue/queues.js';
import { logger } from '../../lib/logger.js';
import * as workflowRepo from '../workflows/workflow.repository.js';
import * as repository from './execution.repository.js';
import { toExecutionDetailDto, toExecutionDto } from './execution.mapper.js';

export async function listExecutions(): Promise<ExecutionDto[]> {
  const records = await repository.findAll();
  return records.map(toExecutionDto);
}

export async function getExecution(id: string): Promise<ExecutionDetailDto> {
  const record = await repository.findByIdWithSteps(id);
  if (!record) throw new NotFoundError('Execution');
  return toExecutionDetailDto(record);
}

const log = logger.child({ module: 'execution.service' });

/**
 * Send a live control command to an execution.
 *
 * The command is first published to the execution's Redis command channel, where a
 * running interpreter (RedisExecutionControl) consumes it (BLUEPRINT.md §10.3).
 * `delivered` is the number of live subscribers that received it.
 *
 * A CANCEL for a run that no interpreter is listening to (delivered === 0) — i.e. still
 * PENDING in the queue, or PAUSED — is applied directly: the row is moved to CANCELLED,
 * any queued job is removed, and a state event is emitted so the dashboard updates.
 * Without this, "Batalkan" on a waiting execution did nothing.
 */
export async function sendCommand(
  id: string,
  input: ExecutionCommandRequest,
): Promise<{ delivered: number }> {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Execution');

  const command: ExecutionCommand = input.command;
  const delivered = await redis.publish(
    executionCommandChannel(id),
    JSON.stringify({ command }),
  );

  if (command === Cmd.CANCEL && delivered === 0) {
    const cancelled = await repository.cancelIfPending(id);
    if (cancelled > 0) {
      await removeQueuedRun(id);
      await emitCancelled(id, record.orderId);
      log.info({ executionId: id }, 'execution cancelled directly (no live interpreter)');
    }
  }

  return { delivered };
}

/** Remove a not-yet-started workflow-run job (test runs use jobId = execution.id). */
async function removeQueuedRun(executionId: string): Promise<void> {
  try {
    const job = await getQueues()[QueueName.WORKFLOW_RUN].getJob(executionId);
    // Only remove if it hasn't started processing; ignore if already active/gone.
    if (job) await job.remove();
  } catch (err) {
    log.warn({ executionId, err }, 'could not remove queued run job (may be active/absent)');
  }
}

/** Emit CANCELLED state + finished events so live dashboards reflect the change. */
async function emitCancelled(executionId: string, orderId: string | null): Promise<void> {
  const ts = Date.now();
  const stateEvent = JSON.stringify({
    type: WsEventType.EXECUTION_STATE,
    executionId,
    ts,
    state: ExecutionState.CANCELLED,
  });
  const finishedEvent = JSON.stringify({
    type: WsEventType.EXECUTION_FINISHED,
    executionId,
    ts,
    state: ExecutionState.CANCELLED,
  });
  void orderId; // orderId not needed in the event payload; kept for future correlation
  for (const payload of [stateEvent, finishedEvent]) {
    await redis.publish(executionChannel(executionId), payload);
    await redis.publish(GLOBAL_EXECUTION_CHANNEL, payload);
  }
}

/**
 * Start a test run: validate the workflow exists, create a PENDING TEST execution, and
 * enqueue a workflow-run job bound to it. The worker picks it up and drives the engine
 * against the (mock, when USE_MOCKS) session manager.
 */
export async function runTest(input: RunTestRequest): Promise<ExecutionDto> {
  const workflow = await workflowRepo.findById(input.workflowId);
  if (!workflow) throw new NotFoundError('Workflow');

  const variables = input.variables ?? {};
  const execution = await repository.createPending({
    workflowId: input.workflowId,
    orderId: null,
    accountId: input.accountId,
    mode: 'TEST',
    variables,
  });

  const job: WorkflowRunJob = {
    executionId: execution.id,
    workflowId: input.workflowId,
    orderId: null,
    accountId: input.accountId,
    mode: 'TEST',
    variables,
  };
  await getQueues()[QueueName.WORKFLOW_RUN].add(QueueName.WORKFLOW_RUN, job, {
    jobId: execution.id,
  });

  return toExecutionDto(execution);
}
