/**
 * Bulk-join worker — processes one group per job.
 * Each job joins all connected promotion accounts to a single Telegram group,
 * writes per-account results to BulkJoinLog, and marks the parent BulkJoinJob
 * COMPLETED once the last group is done.
 *
 * Jobs are scheduled with staggered delays (groupIndex × delayMinutes) so the
 * queue naturally spaces out each group's join wave.
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { bullConnection, QueueName, type BulkJoinGroupJob } from '../queues.js';
import { promotionAccountRepository } from '../../modules/promotion/promotion.repository.js';
import { joinGroups } from '../../modules/promotion/promotion-joiner.js';
import { prisma } from '../../db/client.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'bulk-join-worker' });

export function buildBulkJoinWorker(deps: WorkerBuildDeps = {}): Worker<BulkJoinGroupJob> {
  return new Worker<BulkJoinGroupJob>(
    QueueName.BULK_JOIN,
    (job) => processBulkJoinGroup(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 1,
    },
  );
}

async function processBulkJoinGroup(job: Job<BulkJoinGroupJob>): Promise<void> {
  const { bulkJobId, groupIndex, group, totalGroups } = job.data;

  // Skip if the job was cancelled while this step was queued.
  const bulkJob = await prisma.bulkJoinJob.findUnique({ where: { id: bulkJobId } });
  if (!bulkJob || bulkJob.status === 'CANCELLED') {
    log.info({ bulkJobId, groupIndex }, 'bulk-join job cancelled — skipping step');
    return;
  }

  log.info({ bulkJobId, groupIndex, group, totalGroups }, 'processing bulk-join step');

  // Fetch all currently connected accounts.
  const allAccounts = await promotionAccountRepository.findAll();
  const connected = allAccounts.filter(
    (a: any) => a.status === 'CONNECTED' && a.sessionEnc,
  );

  if (connected.length === 0) {
    log.warn({ bulkJobId, groupIndex }, 'no connected accounts — skipping step');
  } else {
    // Join all accounts to this one group in parallel (no inter-group delay within a step).
    const stepResults = await Promise.all(
      connected.map(async (acc: any) => {
        try {
          const results = await joinGroups(acc.sessionEnc, [group], { delayMs: 0 });
          const r = results[0];
          return {
            accountId: acc.id,
            accountLabel: acc.label,
            phone: acc.phone,
            ok: r?.ok ?? false,
            alreadyMember: r?.alreadyMember ?? false,
            requestSent: r?.requestSent ?? false,
            error: r?.error ?? null,
          };
        } catch (err) {
          return {
            accountId: acc.id,
            accountLabel: acc.label,
            phone: acc.phone,
            ok: false,
            alreadyMember: false,
            requestSent: false,
            error: String(err),
          };
        }
      }),
    );

    await prisma.bulkJoinLog.createMany({
      data: stepResults.map((r) => ({
        jobId: bulkJobId,
        groupIndex,
        group,
        accountId: r.accountId,
        accountLabel: r.accountLabel,
        phone: r.phone,
        ok: r.ok,
        alreadyMember: r.alreadyMember,
        requestSent: r.requestSent,
        error: r.error,
      })),
    });

    const okCount = stepResults.filter((r) => r.ok || r.alreadyMember).length;
    log.info({ bulkJobId, groupIndex, group, okCount, total: connected.length }, 'bulk-join step done');
  }

  // Mark the parent job COMPLETED when this is the last group.
  if (groupIndex === totalGroups - 1) {
    await prisma.bulkJoinJob.update({
      where: { id: bulkJobId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    log.info({ bulkJobId }, 'bulk-join job completed');
  }
}
