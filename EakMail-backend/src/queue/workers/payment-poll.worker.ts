/**
 * Payment poll worker (BLUEPRINT.md §5.2 "poll fallback", TASKS.md Phase 5).
 *
 * A safety net for missed Pakasir webhooks. For a still-PENDING order it reconciles state:
 *   - if the payment is already PAID locally (e.g. a webhook landed meanwhile) → ensure the
 *     order is PAID and fulfillment is enqueued (idempotent), then stop polling.
 *   - if the payment window has expired (expiresAt passed) → mark the order EXPIRED, stop.
 *   - otherwise → re-schedule another poll after a delay, until the expiry cap.
 *
 * NOTE: the frozen PakasirClient seam exposes only create-transaction (no status query), so
 * this worker reconciles against locally-known payment state rather than calling the provider
 * for status. When a provider status endpoint is added to the seam, plug it in here.
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { OrderStatus, PaymentStatus } from '@eakmail/shared-types';
import { logger } from '../../lib/logger.js';
import {
  bullConnection,
  getQueues,
  QueueName,
  type PaymentPollJob,
} from '../queues.js';
import { orderRepository } from '../../modules/orders/order.repository.js';
import { prisma } from '../../db/client.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'payment-poll-worker' });

/** Delay between poll attempts for an order still awaiting payment. */
const POLL_INTERVAL_MS = 30_000;

export function buildPaymentPollWorker(deps: WorkerBuildDeps = {}): Worker<PaymentPollJob> {
  return new Worker<PaymentPollJob>(
    QueueName.PAYMENT_POLL,
    (job) => processPoll(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 2,
      ...(deps.limiter ? { limiter: deps.limiter } : {}),
    },
  );
}

async function processPoll(job: Job<PaymentPollJob>): Promise<void> {
  const { orderId } = job.data;
  const order = await orderRepository.findById(orderId);
  if (!order) {
    log.info({ orderId }, 'poll: order not found — stopping');
    return;
  }

  // Terminal-for-polling states: nothing more to reconcile.
  if (order.status !== OrderStatus.PENDING) {
    log.info({ orderId, status: order.status }, 'poll: order no longer pending — stopping');
    return;
  }

  const payment = order.payment;

  // Payment settled but order still PENDING (missed webhook): drive it PAID + fulfill.
  if (payment?.status === PaymentStatus.PAID) {
    await promoteToPaidAndFulfill(orderId);
    return;
  }

  // Expired payment window → expire the order (guarded; no-op if not PENDING anymore).
  if (isExpired(payment?.expiresAt ?? null)) {
    const expired = await orderRepository.markExpired(orderId);
    log.info({ orderId, expired }, 'poll: payment window elapsed');
    return;
  }

  // Still waiting: schedule another poll.
  await getQueues()[QueueName.PAYMENT_POLL].add(
    'poll',
    { orderId },
    { delay: POLL_INTERVAL_MS, jobId: `poll-${orderId}-${Date.now()}` },
  );
}

/**
 * Idempotently move a settled payment's order to PAID and enqueue fulfillment. The guarded
 * PENDING→PAID transition + the deduped `fulfill:<orderId>` job id (shared with the webhook
 * path) together ensure fulfillment is enqueued exactly once.
 */
async function promoteToPaidAndFulfill(orderId: string): Promise<void> {
  // Resolve quantity + stockMode to decrement stock atomically on PAID
  const orderMeta = await prisma.order.findUnique({
    where: { id: orderId },
    select: { quantity: true, product: { select: { stockMode: true } } },
  });
  const isManualStock = orderMeta?.product.stockMode === 'MANUAL';
  const decrementStock = isManualStock ? (orderMeta?.quantity ?? 0) : 0;

  const promoted = await orderRepository.markPaid(orderId, decrementStock);
  if (!promoted) {
    log.info({ orderId }, 'poll: order already advanced — no enqueue');
    return;
  }
  await getQueues()[QueueName.ORDER_FULFILLMENT].add(
    'fulfill',
    { orderId },
    { jobId: `fulfill-${orderId}` },
  );
  log.info({ orderId }, 'poll: reconciled PAID and enqueued fulfillment');
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt != null && expiresAt.getTime() <= Date.now();
}
