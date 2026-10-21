/**
 * DANA event service — receives parsed notification events from Eak-DANA APK,
 * deduplicates them, tries to match a pending order, and marks it PAID or REVIEW.
 *
 * Security: this service is called only after danaDeviceService.verify() confirms
 * the Bearer token. It never trusts the event as proof of payment — the backend
 * reconciles against a real pending order row.
 */
import { OrderStatus, PaymentStatus } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import { logger } from '../../lib/logger.js';
import type {
  DanaNotificationEvent,
  DanaEventResult,
  DanaDeviceStatus,
} from './dana-event.types.js';

const log = logger.child({ module: 'dana-event-service' });

/** Tolerance window: match an order whose amount is within ±1 Rupiah (float safety). */
const AMOUNT_TOLERANCE = 1;

/** Only match orders created within this window to prevent old-order false matches. */
const ORDER_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export const danaEventService = {
  /**
   * Process one DANA notification event from the APK.
   * Idempotent: duplicate notification_id → returns DUPLICATE without re-processing.
   */
  async processEvent(
    event: DanaNotificationEvent,
    deviceId: string,
  ): Promise<DanaEventResult> {
    // 1. Deduplicate by notification_id
    const existing = await prisma.danaEvent.findUnique({
      where: { notificationId: event.notification_id },
      select: { id: true, eventStatus: true },
    });
    if (existing) {
      log.info({ notificationId: event.notification_id }, 'Duplicate DANA event — ignored');
      return { status: 'DUPLICATE', event_id: existing.id };
    }

    // 2. Try to match a pending order if we have a parsed amount
    let matchedOrderId: string | null = null;
    let eventStatus: 'ACCEPTED' | 'NO_MATCH' = 'NO_MATCH';

    if (event.parsed_amount !== null && event.parsed_amount > 0) {
      const windowStart = new Date(Date.now() - ORDER_MATCH_WINDOW_MS);
      const candidate = await prisma.order.findFirst({
        where: {
          status: OrderStatus.PENDING,
          amount: {
            gte: event.parsed_amount - AMOUNT_TOLERANCE,
            lte: event.parsed_amount + AMOUNT_TOLERANCE,
          },
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (candidate) {
        matchedOrderId = candidate.id;
        eventStatus = 'ACCEPTED';
      }
    }

    // 3. Persist the event
    const row = await prisma.danaEvent.create({
      data: {
        notificationId: event.notification_id,
        deviceId,
        rawTitle: event.raw_title,
        rawBody: event.raw_body,
        parsedAmount: event.parsed_amount,
        parsedDescription: event.parsed_description,
        eventStatus,
        orderId: matchedOrderId,
      },
    });

    // 4. If matched → mark payment PAID and enqueue fulfillment
    if (matchedOrderId) {
      await settleMatchedOrder(matchedOrderId, row.id);
    } else {
      log.info(
        { notificationId: event.notification_id, parsedAmount: event.parsed_amount },
        'DANA event stored — no matching order found',
      );
    }

    return { status: eventStatus, event_id: row.id };
  },

  /** Stats for GET /api/payments/dana/status */
  async getDeviceStatus(deviceId: string): Promise<DanaDeviceStatus> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [last, count] = await Promise.all([
      prisma.danaEvent.findFirst({
        where: { deviceId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.danaEvent.count({
        where: { deviceId, createdAt: { gte: todayStart } },
      }),
    ]);

    return {
      device_id: deviceId,
      last_event_at: last?.createdAt.toISOString() ?? null,
      total_events_today: count,
    };
  },

  /** List recent events for the dashboard (newest first, last 200). */
  async listEvents(limit = 200) {
    return prisma.danaEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        notificationId: true,
        deviceId: true,
        rawTitle: true,
        rawBody: true,
        parsedAmount: true,
        parsedDescription: true,
        eventStatus: true,
        orderId: true,
        createdAt: true,
      },
    });
  },
};

/**
 * Mark a matched order as PAID via DANA and enqueue fulfillment.
 * Uses a transaction to ensure the order + payment update are atomic.
 * Idempotent: if order is already PAID, does nothing.
 */
async function settleMatchedOrder(orderId: string, danaEventId: string): Promise<void> {
  try {
    const settled = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      // Guard: only settle PENDING orders — return false to skip enqueue
      if (!order || order.status !== OrderStatus.PENDING) {
        log.info({ orderId }, 'DANA settle skipped — order not PENDING');
        return false;
      }

      // Upsert payment row for this DANA payment
      await tx.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          provider: 'dana',
          method: 'DANA',
          amount: 0, // actual amount stored in danaEvent.parsedAmount
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
        update: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Advance order to PAID
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

      // Link the event to this order (may already be set, idempotent)
      await tx.danaEvent.update({
        where: { id: danaEventId },
        data: { orderId },
      });

      return true;
    });

    // Only enqueue fulfillment when the transaction actually settled the order
    if (!settled) return;

    await getQueues()[QueueName.ORDER_FULFILLMENT].add(
      'fulfill',
      { orderId },
      { jobId: `fulfill-${orderId}` },
    );

    log.info({ orderId, danaEventId }, 'DANA payment matched — order PAID, fulfillment enqueued');
  } catch (err) {
    log.error({ orderId, danaEventId, err }, 'Failed to settle DANA-matched order');
  }
}
