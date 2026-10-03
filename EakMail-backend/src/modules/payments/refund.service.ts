/**
 * Refund path (PRD.md FR-8, TASKS.md Phase 5): when fulfillment fails after payment,
 * the order sits at REFUND_PENDING; this settles it to REFUNDED and notifies the
 * customer. Idempotent — a repeated refund never double-notifies.
 *
 * Customer-facing copy is NOT hardcoded here: the caller (fulfillment worker / bot
 * layer, which owns the i18n catalog) passes the already-localized `notifyText`.
 * ARCHITECTURE.md §8.
 */
import { logger } from '../../lib/logger.js';
import { NotFoundError } from '../../lib/errors.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import { paymentRepository } from './payment.repository.js';

const log = logger.child({ module: 'refund-service' });

export interface RefundInput {
  orderId: string;
  /** Localized customer message, resolved by the caller from the bot i18n catalog. */
  notifyText?: string;
}

export const refundService = {
  /**
   * Settle a refund for an order and notify the customer (if a message is provided).
   * Returns true when this call performed the transition; false on a replay.
   */
  async refundOrder(input: RefundInput): Promise<boolean> {
    const order = await paymentRepository.findOrderWithCustomer(input.orderId);
    if (!order) throw new NotFoundError('Order');

    const transitioned = await paymentRepository.markRefunded(input.orderId);
    if (!transitioned) {
      log.info({ orderId: input.orderId }, 'Refund already applied — ignored');
      return false;
    }

    if (input.notifyText) {
      await getQueues()[QueueName.NOTIFICATIONS].add(
        'refund-notice',
        { customerTelegramId: order.customer.telegramId, text: input.notifyText },
        { jobId: `refund-notice-${input.orderId}` },
      );
    }

    log.info({ orderId: input.orderId }, 'Order refunded');
    return true;
  },
};
