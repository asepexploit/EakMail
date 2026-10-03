/**
 * System status route — powers the dashboard status bar + navbar health dot.
 *
 *   GET /api/status  → { worker, queueDepth, activeExecutions }
 *
 * "worker" reflects whether the background workers can run, which requires Redis to be
 * reachable (BullMQ broker). Queue depth sums waiting+active across the work queues;
 * activeExecutions counts executions currently RUNNING. Thin route: reads only.
 */
import type { FastifyInstance } from 'fastify';
import { ExecutionState } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';
import { redis } from '../../lib/redis.js';
import { getQueues } from '../../queue/queues.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'status-routes' });

export interface SystemStatus {
  worker: boolean;
  queueDepth: number;
  activeExecutions: number;
}

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (): Promise<SystemStatus> => {
    let worker = false;
    let queueDepth = 0;
    let activeExecutions = 0;

    try {
      // Redis reachable → the BullMQ workers (same process) are operational.
      const pong = await redis.ping();
      worker = pong === 'PONG';
    } catch (err) {
      log.warn({ err }, 'redis ping failed');
    }

    if (worker) {
      try {
        const queues = getQueues();
        const counts = await Promise.all(
          Object.values(queues).map((q) => q.getJobCounts('waiting', 'active', 'delayed')),
        );
        queueDepth = counts.reduce(
          (sum, c) => sum + (c.waiting ?? 0) + (c.active ?? 0) + (c.delayed ?? 0),
          0,
        );
      } catch (err) {
        log.warn({ err }, 'queue counts failed');
      }
    }

    try {
      activeExecutions = await prisma.execution.count({
        where: { state: ExecutionState.RUNNING },
      });
    } catch (err) {
      log.warn({ err }, 'active executions count failed');
    }

    return { worker, queueDepth, activeExecutions };
  });
}
