/**
 * Order data access for the storefront bot flow (Phase 3a: "order creation (PENDING)
 * with idempotency key"). Scoped to what the bot needs — create a pending order and
 * read one back for /status. No HTTP, no business rules (backend-guide.md §2).
 *
 * The admin dashboard's orders module owns richer order queries; this file only
 * covers the customer-initiated create/read path so the bot stays self-contained.
 */
import { Prisma, type Order, type Product } from '@prisma/client';
import { prisma } from '../../db/client.js';

export type OrderWithProduct = Order & { product: Product };

/**
 * Create a PENDING order idempotently. When `decrementStock` > 0 (manual stock mode),
 * the product's stock is atomically decremented by that amount in the same transaction.
 *
 * Idempotency is only honored while the existing order is still PENDING. If a prior order
 * with the same key has already moved to a terminal state (DELIVERED/FAILED/REFUNDED/EXPIRED)
 * we create a fresh order with a suffixed key so the user's intent to re-buy is respected.
 */
export async function createPendingOrder(input: {
  customerId: string;
  productId: string;
  quantity: number;
  amount: number;
  idempotencyKey: string;
  /** Selected product option key (e.g. "seller") — stored on the first linked execution. */
  optionKey?: string;
  /** Selected product option value (e.g. "Netflix Premium") — passed to workflow variables. */
  optionValue?: string;
}): Promise<OrderWithProduct> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { product: true },
  });
  if (existing && existing.status === 'PENDING') return existing;

  // If a prior attempt with the same key is already closed, suffix the key with a nonce so a
  // new row can be created (uniqueness is enforced on `idempotencyKey`).
  const effectiveKey = existing
    ? `${input.idempotencyKey}:${Date.now().toString(36)}`
    : input.idempotencyKey;

  // Stock is decremented only when payment is confirmed (PAID), not on PENDING.
  // This prevents stock from being locked by unpaid orders.
  try {
    return await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId: input.customerId,
          productId: input.productId,
          quantity: input.quantity,
          amount: input.amount,
          idempotencyKey: effectiveKey,
          optionKey: input.optionKey ?? null,
          optionValue: input.optionValue ?? null,
        },
        include: { product: true },
      });
    });
  } catch (err) {
    // Race: a concurrent call with the same key won the insert. Resolve by returning that row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.order.findUnique({
        where: { idempotencyKey: effectiveKey },
        include: { product: true },
      });
      if (raced) return raced;
    }
    throw err;
  }
}

/** Read one order that belongs to a given customer (scoping so /status can't leak others). */
export async function findCustomerOrder(
  orderId: string,
  customerId: string,
): Promise<OrderWithProduct | null> {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: { product: true },
  });
}
