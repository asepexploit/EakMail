/**
 * Broadcast worker (customer messaging). Consumes `{ broadcastId }` from the dedicated
 * broadcast queue, loads every not-blocked customer, and fans the message out via the
 * storefront bot sender — text, or a captioned photo when the broadcast carries an image.
 *
 * Pacing: sends are serialized with a small inter-send delay so we stay under the Telegram
 * Bot API's ~30 msgs/sec ceiling (target ~25/sec). Per-recipient failures are caught and
 * counted (failedCount) instead of aborting the run; successes increment sentCount. Progress
 * is persisted periodically so the dashboard reflects a long run in flight. On completion the
 * broadcast is moved to COMPLETED with finishedAt; an unexpected fatal error marks it FAILED.
 *
 * Under USE_MOCKS (or when the bot has no live client) the sender no-ops/logs and returns
 * success, so counters still advance as 'sent' — never connects live (task rule).
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { BroadcastStatus } from '@eakmail/shared-types';
import { logger } from '../../lib/logger.js';
import { broadcastRepository } from '../../modules/broadcast/broadcast.repository.js';
import {
  BROADCAST_QUEUE_NAME,
  broadcastWorkerConnection,
  type BroadcastJob,
} from '../../modules/broadcast/broadcast.queue.js';
import { sendPhotoToCustomer, sendToCustomer } from '../../telegram/bot/sender.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'broadcast-worker' });

/** ~25 msgs/sec: a 45ms gap between sends keeps us comfortably under the Bot API ceiling. */
const SEND_DELAY_MS = 45;
/** Persist counters every N recipients so a long run's progress is visible mid-flight. */
const PROGRESS_FLUSH_EVERY = 25;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function buildBroadcastWorker(deps: WorkerBuildDeps = {}): Worker<BroadcastJob> {
  return new Worker<BroadcastJob>(BROADCAST_QUEUE_NAME, (job) => processBroadcast(job), {
    connection: broadcastWorkerConnection(),
    // One broadcast job fans out to many recipients internally; keep the queue itself serial
    // so two broadcasts don't compete for the shared Bot API rate budget.
    concurrency: deps.concurrency ?? 1,
    limiter: deps.limiter,
  });
}

async function processBroadcast(job: Job<BroadcastJob>): Promise<void> {
  const { broadcastId } = job.data;

  const broadcast = await broadcastRepository.findById(broadcastId);
  if (!broadcast) {
    log.warn({ broadcastId }, 'broadcast not found — skipping');
    return;
  }

  // Idempotency: a BullMQ retry (or duplicate enqueue) must NEVER re-fan-out to every customer.
  // Only PENDING/SENDING broadcasts are eligible for processing. A COMPLETED/FAILED row has
  // already been finalized by a prior run.
  if (broadcast.status !== BroadcastStatus.SENDING && broadcast.status !== BroadcastStatus.DRAFT) {
    log.info(
      { broadcastId, status: broadcast.status },
      'broadcast already finalized — skipping fan-out',
    );
    return;
  }

  const targets = await broadcastRepository.findTargets();
  log.info({ broadcastId, targets: targets.length }, 'broadcast fan-out starting');

  const hasImage = Boolean(broadcast.imageUrl);
  let sentCount = 0;
  let failedCount = 0;

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target) continue;
      const { telegramId } = target;

      const ok = hasImage
        ? await sendPhotoToCustomer(telegramId, broadcast.imageUrl as string, broadcast.message)
        : await sendToCustomer(telegramId, broadcast.message);

      if (ok) sentCount += 1;
      else failedCount += 1;

      if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
        await broadcastRepository.updateProgress(broadcastId, { sentCount, failedCount });
      }

      // Pace all but the last send.
      if (i < targets.length - 1) await delay(SEND_DELAY_MS);
    }

    await broadcastRepository.finish(broadcastId, {
      status: BroadcastStatus.COMPLETED,
      sentCount,
      failedCount,
      finishedAt: new Date(),
    });
    log.info({ broadcastId, sentCount, failedCount }, 'broadcast completed');
  } catch (err) {
    // Unexpected fatal error (per-recipient failures are already caught by the sender):
    // persist what we managed and mark the run FAILED so it doesn't hang in SENDING.
    log.error({ err, broadcastId, sentCount, failedCount }, 'broadcast failed');
    await broadcastRepository.finish(broadcastId, {
      status: BroadcastStatus.FAILED,
      sentCount,
      failedCount,
      finishedAt: new Date(),
    });
    throw err;
  }
}
