/**
 * Worker registry (TASKS.md Phase 5, ARCHITECTURE.md §7). `startWorkers()` constructs and
 * returns every BullMQ worker with sensible per-queue concurrency + limiters, and exposes a
 * matching `stopWorkers()` for graceful shutdown.
 *
 * Concurrency notes:
 *  - order-fulfillment runs a few in parallel; the real per-account serialization + Telegram
 *    pacing is enforced inside the session manager and the advisory per-order lock, so a
 *    global limiter here just smooths bursts.
 *  - notifications is rate-limited to stay well under Telegram Bot API limits.
 */
import type { Worker } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { buildOrderFulfillmentWorker } from './order-fulfillment.worker.js';
import { buildWorkflowRunWorker } from './workflow-run.worker.js';
import { buildPaymentPollWorker } from './payment-poll.worker.js';
import { buildNotificationsWorker } from './notifications.worker.js';
import { buildBroadcastWorker } from './broadcast.worker.js';
import { buildPromotionWorker } from './promotion.worker.js';
import { buildBulkJoinWorker } from './bulk-join.worker.js';

const log = logger.child({ module: 'workers' });

export interface StartedWorkers {
  workers: Worker[];
  stop(): Promise<void>;
}

/** Construct and start all queue workers. Returns handles + a graceful stop(). */
export function startWorkers(): StartedWorkers {
  const workers: Worker[] = [
    buildOrderFulfillmentWorker({
      concurrency: 5,
      // Cap fulfillment starts so a flood of paid orders does not open too many Telegram
      // conversations at once (per-account pacing still applies downstream).
      limiter: { max: 10, duration: 1000 },
    }),
    buildWorkflowRunWorker({ concurrency: 3 }),
    buildPaymentPollWorker({ concurrency: 2 }),
    buildNotificationsWorker({ concurrency: 10, limiter: { max: 25, duration: 1000 } }),
    // Broadcast runs serially (one fan-out at a time) and paces its own sends internally to
    // stay under the Bot API rate ceiling, so no queue-level limiter is needed here.
    buildBroadcastWorker({ concurrency: 1 }),
    buildPromotionWorker({ concurrency: 2 }),
    // Bulk-join runs serially (one group step at a time per job) to respect Telegram rate limits.
    buildBulkJoinWorker({ concurrency: 1 }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      log.error({ queue: worker.name, jobId: job?.id, err }, 'job failed');
    });
    worker.on('completed', (job) => {
      log.debug({ queue: worker.name, jobId: job.id }, 'job completed');
    });
  }

  log.info({ count: workers.length }, 'workers started');

  return {
    workers,
    async stop() {
      await Promise.all(workers.map((w) => w.close()));
      log.info('workers stopped');
    },
  };
}

export { buildOrderFulfillmentWorker } from './order-fulfillment.worker.js';
export { buildWorkflowRunWorker } from './workflow-run.worker.js';
export { buildPaymentPollWorker } from './payment-poll.worker.js';
export { buildNotificationsWorker } from './notifications.worker.js';
export { buildBroadcastWorker } from './broadcast.worker.js';
export { buildPromotionWorker } from './promotion.worker.js';
export { buildBulkJoinWorker } from './bulk-join.worker.js';
