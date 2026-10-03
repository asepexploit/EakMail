/**
 * Order data access (Prisma only — no HTTP, no business decisions).
 * Owns reads/writes of the Order row plus the guarded state transitions that must be
 * atomic (BLUEPRINT.md §5.2). Guarded transitions use `updateMany` with a status filter
 * so a replayed transition is a no-op and returns `false` — the caller then knows whether
 * it "won" and may fire a one-shot side effect (enqueue / notify) exactly once.
 * ARCHITECTURE.md §11.
 */
import type { Prisma } from '@prisma/client';
import { OrderStatus } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';

/** An order joined with the relations the order flow reads. */
const orderWithRelations = {
  include: {
    payment: true,
    delivery: true,
    // Many executions can belong to one order (one per fulfillment iteration when quantity > 1).
    // Expose the latest one for callers that only need "the current execution".
    executions: { orderBy: { createdAt: 'desc' }, take: 1 },
  },
} satisfies Prisma.OrderDefaultArgs;

export type OrderRecord = Prisma.OrderGetPayload<typeof orderWithRelations>;

/**
 * Full fulfillment context resolved in one query: order → product → workflow (explicit or
 * supplier default) → supplier → its bound account ids, plus the customer telegram id.
 * The worker picks the account/workflow from here rather than issuing N follow-up reads.
 */
const orderForFulfillment = {
  select: {
    id: true,
    productId: true,
    quantity: true,
    amount: true,
    optionKey: true,
    optionValue: true,
    customer: { select: { telegramId: true, language: true } },
    product: {
      include: {
        workflow: true,
        supplier: {
          include: {
            defaultWorkflow: true,
            accounts: { select: { accountId: true } },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderDefaultArgs;

export type OrderFulfillmentContext = Prisma.OrderGetPayload<typeof orderForFulfillment>;

export interface CreateOrderData {
  customerId: string;
  productId: string;
  amount: number;
  idempotencyKey: string;
  /** Number of units ordered; defaults to 1 if omitted. */
  quantity?: number;
}

export const orderRepository = {
  findAll(where: Prisma.OrderWhereInput, skip: number, take: number): Promise<OrderRecord[]> {
    return prisma.order.findMany({
      where,
      ...orderWithRelations,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  count(where: Prisma.OrderWhereInput): Promise<number> {
    return prisma.order.count({ where });
  },

  findById(id: string): Promise<OrderRecord | null> {
    return prisma.order.findUnique({ where: { id }, ...orderWithRelations });
  },

  findByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null> {
    return prisma.order.findUnique({ where: { idempotencyKey }, ...orderWithRelations });
  },

  findForFulfillment(id: string): Promise<OrderFulfillmentContext | null> {
    return prisma.order.findUnique({ where: { id }, ...orderForFulfillment });
  },

  create(data: CreateOrderData): Promise<OrderRecord> {
    return prisma.order.create({
      data: {
        customerId: data.customerId,
        productId: data.productId,
        amount: data.amount,
        idempotencyKey: data.idempotencyKey,
        quantity: data.quantity ?? 1,
        status: OrderStatus.PENDING,
      },
      ...orderWithRelations,
    });
  },

  // ---- guarded state transitions (BLUEPRINT.md §5.2) -------------------------

  /**
   * Move a PAID order into FULFILLING. Returns true only when this call performed the
   * transition, so a replayed fulfillment job cannot start a second execution.
   */
  async startFulfilling(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PAID },
      data: { status: OrderStatus.FULFILLING },
    });
    return res.count === 1;
  },

  /** Move a FULFILLING order to DELIVERED. Returns true when this call won. */
  async markDelivered(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.FULFILLING },
      data: { status: OrderStatus.DELIVERED },
    });
    return res.count === 1;
  },

  /**
   * Move a PAID/FULFILLING order to FAILED. Returns true when this call won so the
   * refund path is entered exactly once.
   */
  async markFailed(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: { in: [OrderStatus.PAID, OrderStatus.FULFILLING] } },
      data: { status: OrderStatus.FAILED },
    });
    return res.count === 1;
  },

  /** Move a REFUND_PENDING order to REFUNDED (balance refund path). Returns true when it won. */
  async markRefunded(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.REFUND_PENDING },
      data: { status: OrderStatus.REFUNDED },
    });
    return res.count === 1;
  },

  /** Move a FAILED order to REFUND_PENDING. Returns true when this call won. */
  async markRefundPending(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.FAILED },
      data: { status: OrderStatus.REFUND_PENDING },
    });
    return res.count === 1;
  },

  /**
   * Move a PENDING order to PAID (poll fallback for a missed webhook). Returns true when
   * this call performed the transition, so fulfillment is enqueued exactly once.
   * When `decrementStock` > 0 (manual stock mode), atomically deducts stock in the same tx.
   */
  async markPaid(orderId: string, decrementStock = 0): Promise<boolean> {
    if (decrementStock > 0) {
      // Fetch productId for the stock update
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { productId: true, status: true } });
      if (!order || order.status !== OrderStatus.PENDING) return false;
      await prisma.$transaction([
        prisma.order.updateMany({ where: { id: orderId, status: OrderStatus.PENDING }, data: { status: OrderStatus.PAID } }),
        prisma.product.update({ where: { id: order.productId }, data: { stock: { decrement: decrementStock } } }),
      ]);
      // Check the order actually transitioned (another process may have beaten us)
      const updated = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      return updated?.status === OrderStatus.PAID;
    }
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID },
    });
    return res.count === 1;
  },

  /** Move a PENDING order to EXPIRED (payment never arrived). Returns true when it won. */
  async markExpired(orderId: string): Promise<boolean> {
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.EXPIRED },
    });
    return res.count === 1;
  },

  /**
   * Reset a FAILED/REFUND_PENDING order back to PAID so a manual retry can re-run the
   * fulfillment worker. Guarded to those two states. Returns true when it won.
   *
   * Refuses when the related Payment has already been REFUNDED — resuming fulfillment on
   * refunded money would deliver goods for free. Admins must manually re-charge in that case.
   */
  async resetForRetry(orderId: string): Promise<boolean> {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (payment && payment.status === 'REFUNDED') {
      return false;
    }
    const res = await prisma.order.updateMany({
      where: { id: orderId, status: { in: [OrderStatus.FAILED, OrderStatus.REFUND_PENDING] } },
      data: { status: OrderStatus.PAID },
    });
    return res.count === 1;
  },

  // ---- delivery (exactly-once) ----------------------------------------------

  findDelivery(orderId: string) {
    return prisma.delivery.findUnique({ where: { orderId } });
  },

  /**
   * Persist the encrypted delivery payload. The unique constraint on `orderId` makes this
   * the exactly-once gate: a duplicate insert throws P2002 and is reported as `duplicate`.
   */
  async createDelivery(orderId: string, payloadEnc: string): Promise<'created' | 'duplicate'> {
    try {
      await prisma.delivery.create({ data: { orderId, payloadEnc } });
      return 'created';
    } catch (err) {
      if (isUniqueViolation(err)) return 'duplicate';
      throw err;
    }
  },
};

/** Prisma unique-constraint violation (P2002) type guard. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}
