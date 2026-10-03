/**
 * Workflow-run worker (BLUEPRINT.md §10 test mode). Runs a workflow WITHOUT an order or a
 * Delivery — used by the admin "test run" feature. It streams the same live events as
 * production (via the Redis emitter inside the execution runner) so the dashboard monitor
 * works identically; it simply never touches order state or persists a delivery.
 *
 * The job carries the workflow id + seed variables; the graph is loaded fresh so a test runs
 * the current draft. When an accountId is supplied a real/mock conversation is opened;
 * otherwise the run proceeds with no conversation (pure logic workflows).
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { WorkflowGraph } from '@eakmail/shared-types';
import { logger } from '../../lib/logger.js';
import { NotFoundError } from '../../lib/errors.js';
import { bullConnection, QueueName, type WorkflowRunJob } from '../queues.js';
import * as workflowRepository from '../../modules/workflows/workflow.repository.js';
import * as supplierRepository from '../../modules/suppliers/supplier.repository.js';
import { runWorkflowExecution } from './execution-runner.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'workflow-run-worker' });

export function buildWorkflowRunWorker(deps: WorkerBuildDeps = {}): Worker<WorkflowRunJob> {
  return new Worker<WorkflowRunJob>(
    QueueName.WORKFLOW_RUN,
    (job) => processWorkflowRun(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 3,
      ...(deps.limiter ? { limiter: deps.limiter } : {}),
    },
  );
}

async function processWorkflowRun(job: Job<WorkflowRunJob>): Promise<void> {
  const { executionId: seededExecutionId, workflowId, accountId, variables } = job.data;

  const workflow = await workflowRepository.findById(workflowId);
  if (!workflow) throw new NotFoundError('Workflow');
  const graph = workflow.graph as unknown as WorkflowGraph;

  const peer = accountId ? await resolvePeer(accountId) : null;

  const { executionId, result } = await runWorkflowExecution({
    // Reuse the execution row the API already created + returned to the dashboard, so its
    // live event stream (subscribed by executionId) actually receives this run's events.
    executionId: seededExecutionId,
    workflowId,
    graph,
    orderId: null,
    accountId,
    peer,
    mode: 'TEST',
    // Seed variables arrive as strings from the API; merge with graph defaults happens in
    // the interpreter's variable bag. We spread graph defaults first so seeds override them.
    variables: { ...(graph.variables ?? {}), ...variables },
    signal: new AbortController().signal,
  });

  log.info({ workflowId, executionId, state: result.state }, 'test run finished');
}

/**
 * Pick a supplier bot @username to talk to for a test run. Test mode is account-centric
 * (the admin picks which account to drive); we use that account's first supplier binding as
 * the peer. Returns null when the account has no supplier — the run then has no conversation.
 */
async function resolvePeer(accountId: string): Promise<string | null> {
  const suppliers = await supplierRepository.findAll();
  const owning = suppliers.find((s) => s.accounts.some((a) => a.accountId === accountId));
  return owning?.botUsername ?? null;
}
