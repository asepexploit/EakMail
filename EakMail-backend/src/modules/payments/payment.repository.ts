/**
 * Payment data access (Prisma only — no HTTP, no business decisions).
 * Owns reads/writes of the Payment row and the coupled Order status update on PAID.
 * ARCHITECTURE.md §8, §11.
 */
import type { Payment, Prisma } from '@prisma/client';
import { OrderStatus, PaymentStatus } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';

export interface UpsertPaymentData {
  orderId: string;
  provider: string;
  method: string;
  amount: number;
  fee: number | null;
  pakasirTxnId: string | null;
  qrString: string | null;
  vaNumber: string | null;
  paymentUrl: string | null;
  expiresAt: Date | null;
  raw: Prisma.InputJsonValue;
}

export const paymentRepository = {
  findByOrderId(orderId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { orderId } });
  },

  /** List payments, newest first (for the dashboard Payments page). */
  list(): Promise<Payment[]> {
    return prisma.payment.findMany({ orderBy: { createdAt: 'desc' } });
  },

  /** Read the minimal order fields the payment flow needs (amount + current status). */
  findOrderForPayment(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, amount: true, status: true },
    });
  },

  /** Idempotent create-or-refresh keyed on the unique orderId (find-or-create). */
  upsert(data: UpsertPaymentData): Promise<Payment> {
    const writable = {
      provider: data.provider,
      method: data.method,
      amount: data.amount,
      fee: data.fee,
      pakasirTxnId: data.pakasirTxnId,
      qrString: data.qrString,
      vaNumber: data.vaNumber,
      paymentUrl: data.paymentUrl,
      expiresAt: data.expiresAt,
      raw: data.raw,
    };
    return prisma.payment.upsert({
      where: { orderId: data.orderId },
      create: { orderId: data.orderId, ...writable },
      // Never downgrade a settled payment; only refresh mutable transaction fields.
      update: writable,
    });
  },

  updateStatus(orderId: string, status: PaymentStatus): Promise<Payment> {
    return prisma.payment.update({ where: { orderId }, data: { status } });
  },

  /** Read order + customer telegram id (for refund notification). */
  findOrderWithCustomer(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, customer: { select: { telegramId: true } } },
    });
  },

  /**
   * Atomically move an order to REFUNDED and its payment to REFUNDED. Returns true
   * only when this call performed the transition (order was REFUND_PENDING/PAID),
   * so the refund notification fires exactly once. ARCHITECTURE.md §8; PRD.md FR-8.
   */
  async markRefunded(orderId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: { in: [OrderStatus.REFUND_PENDING, OrderStatus.PAID] } },
        data: { status: OrderStatus.REFUNDED },
      });
      if (updated.count !== 1) return false;
      await tx.payment.updateMany({
        where: { orderId },
        data: { status: PaymentStatus.REFUNDED },
      });
      return true;
    });
  },

  /**
   * Atomically settle a payment + its order to PAID. Returns true only when this
   * call performed the transition (order was not already PAID), so callers can make
   * side effects (enqueue fulfillment) exactly once. ARCHITECTURE.md §8 idempotency.
   */
  async markPaid(orderId: string, txnId: string | null, fee: number | null): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!order) return false;

      await tx.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.PAID,
          ...(txnId ? { pakasirTxnId: txnId } : {}),
          ...(fee != null ? { fee } : {}),
        },
      });

      // Idempotent guard: transition PENDING → PAID once; ignore replays.
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PAID },
      });
      return updated.count === 1;
    });
  },
};
