/**
 * Notifications worker (TASKS.md Phase 5). Consumes `notifications` jobs and relays already-
 * localized text to a customer via the storefront bot sender.
 *
 * Copy is NOT built here: the enqueuing layer (fulfillment delivery, refund service, bot
 * handlers) resolves the customer-facing string from the bot i18n catalog and passes it in
 * the job. This worker's single responsibility is the send. When USE_MOCKS is on, the sender
 * is the mock and no live Bot API call is made.
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { bullConnection, QueueName, type NotificationJob } from '../queues.js';
import { getStorefrontSender } from './storefront-sender.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'notifications-worker' });

export function buildNotificationsWorker(deps: WorkerBuildDeps = {}): Worker<NotificationJob> {
  return new Worker<NotificationJob>(
    QueueName.NOTIFICATIONS,
    (job) => processNotification(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 10,
      // Default a gentle send cap so we never hammer the Bot API; overridable by startup.
      limiter: deps.limiter ?? { max: 25, duration: 1000 },
    },
  );
}

async function processNotification(job: Job<NotificationJob>): Promise<void> {
  const { customerTelegramId, text } = job.data;
  await getStorefrontSender().sendText(customerTelegramId, text);
  log.info({ customerTelegramId, jobId: job.id }, 'notification sent');
}
