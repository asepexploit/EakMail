/**
 * Payment service — the decisions (no HTTP objects, no Prisma queries inline).
 * Responsibilities:
 *  - createTransaction: idempotent create-or-refresh of a Pakasir transaction + Payment.
 *  - verifyWebhook: verify HMAC signature → on PAID settle Payment+Order → enqueue fulfillment.
 *  - getStatus: read current payment for polling.
 * ARCHITECTURE.md §8; TASKS.md Phase 5.
 */
import type { Prisma } from '@prisma/client';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type CreateTransactionRequest,
  type PaymentDto,
  type Language,
} from '@eakmail/shared-types';
import { logger } from '../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import { getPakasirClient } from './client-factory.js';
import { paymentRepository } from './payment.repository.js';
import { toPaymentDto } from './payment.mapper.js';
import { verifyWebhookSignature } from './webhook-verify.js';
import { parseWebhook } from './pakasir-parser.js';
import type { PakasirWebhookEvent } from './pakasir-types.js';
import { settleTopupByOrderId } from './topup.service.js';
import { getOrderQrMsg, clearOrderQrMsg } from '../../telegram/bot/user-state.js';
import { prisma } from '../../db/client.js';
import { t } from '../../telegram/bot/i18n/index.js';
import { MessageKey } from '../../telegram/bot/i18n/keys.js';

const log = logger.child({ module: 'payment-service' });
const PROVIDER = 'pakasir';

export const paymentService = {
  /**
   * Create (or return the existing) Pakasir transaction for an order.
   * Idempotent per orderId: Payment is upserted; Pakasir itself is find-or-create
   * per (slug, order_id), so retries never create a second transaction.
   */
  async createTransaction(req: CreateTransactionRequest): Promise<PaymentDto> {
    const order = await paymentRepository.findOrderForPayment(req.orderId);
    if (!order) throw new NotFoundError('Order');

    if (order.status !== OrderStatus.PENDING) {
      // Already paid/fulfilled/etc: return the existing payment rather than re-charging.
      const existing = await paymentRepository.findByOrderId(req.orderId);
      if (existing) return toPaymentDto(existing);
      throw new ValidationError('Order is not payable');
    }

    const txn = await getPakasirClient().createTransaction({
      orderId: order.id,
      method: req.method,
      amount: order.amount,
    });

    const payment = await paymentRepository.upsert({
      orderId: order.id,
      provider: PROVIDER,
      method: txn.method,
      amount: txn.amount,
      fee: txn.fee,
      pakasirTxnId: txn.txnId,
      qrString: txn.qrString,
      vaNumber: txn.vaNumber,
      paymentUrl: txn.paymentUrl,
      expiresAt: txn.expiresAt,
      raw: txn.raw as Prisma.InputJsonValue,
    });

    // Enqueue a poll job so the order auto-expires if the webhook never arrives.
    // Delay first poll to ~30s after creation; the worker re-schedules itself until expiry.
    await getQueues()[QueueName.PAYMENT_POLL].add(
      'poll',
      { orderId: order.id },
      { delay: 30_000, jobId: `poll-${order.id}-init` },
    );

    log.info({ orderId: order.id, method: txn.method }, 'Pakasir transaction created');
    return toPaymentDto(payment);
  },

  /**
   * Verify a webhook and apply its effect. Returns the resolved event for the route
   * to acknowledge. Throws ValidationError on a bad/missing signature (→ HTTP 400).
   */
  async verifyWebhook(rawBody: Buffer, signature: string | undefined): Promise<PakasirWebhookEvent> {
    if (!await verifyWebhookSignature(rawBody, signature)) {
      throw new ValidationError('Invalid webhook signature');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ValidationError('Invalid webhook body');
    }

    let event: PakasirWebhookEvent;
    try {
      event = parseWebhook(body);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid webhook payload');
    }
    await this.applyWebhookEvent(event);
    return event;
  },

  /** Apply a verified webhook event to persistence + queues (idempotent). */
  async applyWebhookEvent(event: PakasirWebhookEvent): Promise<void> {
    // Topup orders have orderId prefixed with "topup_" — route to topup settlement.
    if (event.orderId.startsWith('topup_') && event.status === PaymentStatus.PAID) {
      await settleTopupByOrderId(event.orderId);
      return;
    }

    const payment = await paymentRepository.findByOrderId(event.orderId);
    if (!payment) {
      // Webhook for an unknown order: log and ignore (do not create phantom rows).
      log.warn({ orderId: event.orderId }, 'Webhook for unknown order — ignored');
      return;
    }

    if (event.status === PaymentStatus.PAID) {
      const transitioned = await paymentRepository.markPaid(event.orderId, event.txnId, event.fee);
      if (transitioned) {
        await getQueues()[QueueName.ORDER_FULFILLMENT].add(
          'fulfill',
          { orderId: event.orderId },
          // Dedupe by orderId so a duplicate webhook never enqueues twice.
          { jobId: `fulfill-${event.orderId}` },
        );
        log.info({ orderId: event.orderId }, 'Order marked PAID; fulfillment enqueued');
        // Notify customer their QRIS payment was received and order is being processed.
        void sendPaymentConfirmedNotification(event.orderId);
      } else {
        log.info({ orderId: event.orderId }, 'Duplicate PAID webhook — already settled, ignored');
      }
      return;
    }

    // Non-PAID terminal states: reflect on the payment only; order stays as-is or is
    // reconciled elsewhere (expiry/failure handled by the poll/fulfillment paths).
    if (event.status === PaymentStatus.EXPIRED || event.status === PaymentStatus.FAILED) {
      if (payment.status === PaymentStatus.PENDING) {
        await paymentRepository.updateStatus(event.orderId, event.status);
        log.info({ orderId: event.orderId, status: event.status }, 'Payment status updated from webhook');
      }
    }
  },

  /** Current payment for an order — used by the polling UI/endpoint. */
  async getStatus(orderId: string): Promise<PaymentDto> {
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment');
    return toPaymentDto(payment);
  },

  /** All payments (dashboard Payments page). Merges order payments + topup requests. */
  async listPayments(): Promise<PaymentDto[]> {
    const [orderPayments, topups] = await Promise.all([
      paymentRepository.list(),
      prisma.topupRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);

    const topupDtos: PaymentDto[] = topups.map((t) => ({
      id: `topup_${t.id}`,
      orderId: `topup_${t.id}`,
      method: PaymentMethod.QRIS,
      amount: t.amount,
      fee: null,
      status: t.status as PaymentDto['status'],
      pakasirTxnId: t.pakasirTxnId,
      qrString: null,
      vaNumber: null,
      paymentUrl: null,
      expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    }));

    return [...orderPayments.map(toPaymentDto), ...topupDtos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
};

async function sendPaymentConfirmedNotification(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        amount: true,
        customer: { select: { telegramId: true, language: true } },
        product: { select: { name: true } },
      },
    });
    if (!order) return;
    const lang = (order.customer.language as Language) ?? 'id';
    const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
    const text = t(MessageKey.PAYMENT_CONFIRMED, lang, {
      productName: order.product.name,
      amount: fmt(order.amount),
      orderId,
    });
    const qrMsg = await getOrderQrMsg(orderId);
    if (qrMsg) void clearOrderQrMsg(orderId);
    await getQueues()[QueueName.NOTIFICATIONS].add(
      'payment-confirmed',
      {
        customerTelegramId: order.customer.telegramId,
        text,
        ...(qrMsg && { editChatId: qrMsg.chatId, editMessageId: qrMsg.messageId, editDeleteMsg: true }),
      },
      { jobId: `payment-confirmed-${orderId}`, attempts: 3, delay: 500 },
    );
  } catch (err) {
    log.warn({ orderId, err }, 'payment confirmed notification failed — non-fatal');
  }
}
