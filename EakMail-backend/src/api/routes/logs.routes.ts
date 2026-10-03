/**
 * Logs routes — dead-letter queue jobs and audit log (DESIGN_SYSTEM.md §9.2).
 * Thin controller: validate → delegate → shape. No business logic here.
 *
 *   GET /api/logs/dead-letter   failed BullMQ jobs across all queues, newest first
 *   POST /api/logs/dead-letter/:queue/:jobId/retry   re-queue a dead-letter job
 *   GET /api/logs/audit          paginated audit log from the AuditLog table
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../lib/errors.js';

const pageSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export async function logsRoutes(app: FastifyInstance): Promise<void> {
  // ---- dead-letter -----------------------------------------------------------

  app.get('/dead-letter', { preHandler: requireAuth }, async () => {
    const queues = getQueues();
    const allFailed: DeadLetterJobDto[] = [];

    for (const [queueName, queue] of Object.entries(queues) as [QueueName, (typeof queues)[QueueName]][]) {
      const jobs = await queue.getFailed(0, 199);
      for (const job of jobs) {
        allFailed.push({
          id: job.id ?? '',
          queue: queueName,
          name: job.name,
          data: job.data as Record<string, unknown>,
          failedReason: job.failedReason ?? 'Unknown error',
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn ?? null,
          finishedOn: job.finishedOn ?? null,
        });
      }
    }

    // Newest first
    allFailed.sort((a, b) => (b.finishedOn ?? b.timestamp) - (a.finishedOn ?? a.timestamp));
    return { items: allFailed, total: allFailed.length };
  });

  app.post('/dead-letter/:queue/:jobId/retry', { preHandler: requireAuth }, async (req) => {
    const { queue: queueName, jobId } = z
      .object({ queue: z.string().min(1), jobId: z.string().min(1) })
      .parse(req.params);

    const queues = getQueues();
    const queue = queues[queueName as QueueName];
    if (!queue) throw new NotFoundError(`Queue "${queueName}"`);

    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundError(`Job ${jobId}`);

    await job.retry('failed');
    return { jobId, queue: queueName, status: 'retried' };
  });

  // ---- audit -----------------------------------------------------------------

  app.get('/audit', { preHandler: requireAuth }, async (req) => {
    const { page, pageSize } = pageSchema.parse(req.query);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { ts: 'desc' },
        skip,
        take: pageSize,
        include: { adminUser: { select: { email: true } } },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        adminEmail: row.adminUser?.email ?? null,
        action: row.action,
        target: row.target,
        meta: row.meta,
        ts: row.ts.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  });
}

// ---- local DTO (not in shared-types: never crosses FE/BE as a write payload) ---

interface DeadLetterJobDto {
  id: string;
  queue: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}
