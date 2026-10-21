/**
 * Queue / background-process monitoring routes.
 *
 *   GET /api/queue-monitor          → per-queue job counts + background process status
 *   GET /api/queue-monitor/failed   → recent failed jobs across all queues
 *
 * Powers the dashboard "System Monitor" page.
 */
import type { FastifyInstance } from 'fastify';
import { getQueues, QueueName } from '../../queue/queues.js';
import { isAutoReplyRunning } from '../../modules/promotion/promotion-auto-reply.js';
import { isMonitorRunning } from '../../modules/promotion/auto-join-monitor.js';
import { isSearchRunning } from '../../modules/promotion/promotion-auto-search.js';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'queue-monitor-routes' });

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

interface RepeatableJobInfo {
  queue: string;
  key: string;
  name: string;
  every: number | null;
  next: number | undefined;
}

interface FailedJobInfo {
  queue: string;
  id: string;
  name: string;
  failedReason: string;
  timestamp: number;
  attemptsMade: number;
  data: Record<string, unknown>;
}

interface BackgroundProcess {
  name: string;
  accountId: string;
  accountLabel: string;
  running: boolean;
}

export async function queueMonitorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const queues = getQueues();
    const queueNames = Object.values(QueueName);

    // Per-queue job counts
    const queueStats: QueueStats[] = await Promise.all(
      queueNames.map(async (name) => {
        const q = queues[name];
        try {
          const counts = await q.getJobCounts(
            'waiting', 'active', 'delayed', 'completed', 'failed', 'paused',
          );
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            paused: counts.paused ?? 0,
          };
        } catch (err) {
          log.warn({ queue: name, err }, 'failed to get queue counts');
          return { name, waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 };
        }
      }),
    );

    // Repeatable jobs
    let repeatableJobs: RepeatableJobInfo[] = [];
    try {
      const allRepeatables = await Promise.all(
        queueNames.map(async (name) => {
          const jobs = await queues[name].getRepeatableJobs();
          return jobs.map((j) => ({
            queue: name,
            key: j.key,
            name: j.name ?? '',
            every: j.every ? Number(j.every) : null,
            next: j.next,
          }));
        }),
      );
      repeatableJobs = allRepeatables.flat();
    } catch (err) {
      log.warn({ err }, 'failed to get repeatable jobs');
    }

    // Background processes — auto-reply, auto-join, auto-search
    const promoAccounts = await prisma.promotionAccount.findMany({
      where: { status: { in: ['CONNECTED'] } },
      select: { id: true, label: true, autoReplyEnabled: true, autoJoinEnabled: true },
    });

    const backgroundProcesses: BackgroundProcess[] = [];

    for (const acc of promoAccounts) {
      if (acc.autoReplyEnabled) {
        backgroundProcesses.push({
          name: 'auto-reply',
          accountId: acc.id,
          accountLabel: acc.label,
          running: isAutoReplyRunning(acc.id),
        });
      }
      if (acc.autoJoinEnabled) {
        backgroundProcesses.push({
          name: 'auto-join',
          accountId: acc.id,
          accountLabel: acc.label,
          running: isMonitorRunning(acc.id),
        });
      }
    }

    backgroundProcesses.push({
      name: 'auto-search',
      accountId: 'global',
      accountLabel: 'Global',
      running: isSearchRunning(),
    });

    return { queues: queueStats, repeatableJobs, backgroundProcesses };
  });

  app.get('/failed', async (request) => {
    const { limit = 20 } = request.query as { limit?: number };
    const queues = getQueues();
    const queueNames = Object.values(QueueName);

    const failedJobs: FailedJobInfo[] = [];

    await Promise.all(
      queueNames.map(async (name) => {
        try {
          const jobs = await queues[name].getFailed(0, Number(limit));
          for (const job of jobs) {
            failedJobs.push({
              queue: name,
              id: job.id ?? '',
              name: job.name,
              failedReason: job.failedReason ?? 'unknown',
              timestamp: job.timestamp,
              attemptsMade: job.attemptsMade,
              data: job.data as Record<string, unknown>,
            });
          }
        } catch (err) {
          log.warn({ queue: name, err }, 'failed to get failed jobs');
        }
      }),
    );

    failedJobs.sort((a, b) => b.timestamp - a.timestamp);
    return { failed: failedJobs.slice(0, Number(limit)) };
  });

  app.delete('/failed', async () => {
    const queues = getQueues();
    const queueNames = Object.values(QueueName);
    let totalCleaned = 0;

    await Promise.all(
      queueNames.map(async (name) => {
        try {
          const jobs = await queues[name].getFailed();
          for (const job of jobs) {
            await job.remove();
            totalCleaned++;
          }
        } catch (err) {
          log.warn({ queue: name, err }, 'failed to clean failed jobs');
        }
      }),
    );

    log.info({ totalCleaned }, 'cleared all failed jobs');
    return { ok: true, cleared: totalCleaned };
  });

  app.post('/retry-failed', async () => {
    const queues = getQueues();
    const queueNames = Object.values(QueueName);
    let totalRetried = 0;

    await Promise.all(
      queueNames.map(async (name) => {
        try {
          const jobs = await queues[name].getFailed();
          for (const job of jobs) {
            await job.retry();
            totalRetried++;
          }
        } catch (err) {
          log.warn({ queue: name, err }, 'failed to retry failed jobs');
        }
      }),
    );

    log.info({ totalRetried }, 'retried all failed jobs');
    return { ok: true, retried: totalRetried };
  });
}
