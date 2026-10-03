/**
 * Payment expiry sweep — runs on startup and periodically.
 * Finds PENDING orders and PENDING topup requests whose Pakasir payment window has
 * elapsed and marks them EXPIRED. Covers orders/topups created before poll-job enqueue
 * was added, and any missed polls.
 */
import { prisma } from '../../db/client.js';
import { OrderStatus } from '@eakmail/shared-types';
import { logger } from '../../lib/logger.js';
import { getQueues, QueueName } from '../../queue/queues.js';

const log = logger.child({ module: 'payment-sweep' });
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Expire all PENDING orders whose payment window has passed.
 * Enqueue poll jobs for orders that still have time left (catches orders missing a poll job).
 */
export async function sweepExpiredPayments(): Promise<void> {
  const now = new Date();
  let expired = 0;
  let enqueued = 0;

  // ---- Orders ---------------------------------------------------------------
  const pendingOrders = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING },
    include: { payment: { select: { expiresAt: true, status: true } } },
  });

  for (const order of pendingOrders) {
    const payment = order.payment;
    if (!payment) continue;

    if (payment.expiresAt && payment.expiresAt <= now) {
      const changed = await prisma.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: { status: 'EXPIRED' },
      });
      if (changed.count > 0) {
        expired++;
        log.info({ orderId: order.id }, 'sweep: expired order');
      }
    } else if (payment.expiresAt && payment.expiresAt > now) {
      const delay = Math.max(0, payment.expiresAt.getTime() - now.getTime() + 5_000);
      await getQueues()[QueueName.PAYMENT_POLL].add(
        'poll',
        { orderId: order.id },
        { delay, jobId: `poll-${order.id}-sweep` },
      );
      enqueued++;
    }
  }

  // ---- TopupRequests --------------------------------------------------------
  const pendingTopups = await prisma.topupRequest.findMany({
    where: { status: 'PENDING' },
    select: { id: true, expiresAt: true },
  });

  let expiredTopups = 0;
  for (const topup of pendingTopups) {
    if (topup.expiresAt && topup.expiresAt <= now) {
      const changed = await prisma.topupRequest.updateMany({
        where: { id: topup.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      if (changed.count > 0) {
        expiredTopups++;
        log.info({ topupId: topup.id }, 'sweep: expired topup request');
      }
    }
  }

  if (expired > 0 || enqueued > 0 || expiredTopups > 0) {
    log.info({ expired, enqueued, expiredTopups }, 'payment sweep completed');
  }
}

/** Start the periodic sweep. Returns a cleanup function. */
export function startPaymentSweep(): () => void {
  // Run once immediately on startup, then every minute.
  void sweepExpiredPayments();
  const interval = setInterval(() => void sweepExpiredPayments(), SWEEP_INTERVAL_MS);
  return () => clearInterval(interval);
}
