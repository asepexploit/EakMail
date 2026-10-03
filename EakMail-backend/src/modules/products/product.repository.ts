/**
 * Product data access (Prisma). No HTTP, no business rules — see backend-guide.md §2.
 * Owns Product + its ProductOption children and the audit-log write for price changes.
 */
import type { Prisma, Product, ProductOption, AuditLog } from '@prisma/client';
import { prisma } from '../../db/client.js';

/** A product row with its options eagerly loaded — the shape services map to DTOs. */
export type ProductWithOptions = Product & { options: ProductOption[] };

const withOptions = { options: true } as const;

export function findAll(): Promise<ProductWithOptions[]> {
  return prisma.product.findMany({
    include: withOptions,
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id: string): Promise<ProductWithOptions | null> {
  return prisma.product.findUnique({
    where: { id },
    include: withOptions,
  });
}

export function create(
  data: Prisma.ProductCreateInput,
): Promise<ProductWithOptions> {
  return prisma.product.create({
    data,
    include: withOptions,
  });
}

/**
 * Update a product and fully replace its options in one transaction.
 * Options have no stable client id on upsert, so we delete-and-recreate the set.
 */
export function updateWithOptions(
  id: string,
  data: Prisma.ProductUpdateInput,
  options: Prisma.ProductOptionCreateManyProductInput[],
): Promise<ProductWithOptions> {
  return prisma.$transaction(async (tx) => {
    await tx.productOption.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        ...data,
        options: { createMany: { data: options } },
      },
      include: withOptions,
    });
  });
}

export function setActive(
  id: string,
  active: boolean,
): Promise<ProductWithOptions> {
  return prisma.product.update({
    where: { id },
    data: { active },
    include: withOptions,
  });
}

export function remove(id: string): Promise<Product> {
  return prisma.product.delete({ where: { id } });
}

/**
 * Atomically decrement stock by `qty`, only when current stock >= qty.
 * Works for any stockMode — caller decides when to invoke.
 * Returns the number of rows updated (0 = stock was already insufficient).
 */
export function decrementStock(id: string, qty: number): Promise<{ count: number }> {
  return prisma.product.updateMany({
    where: { id, stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });
}

/**
 * Atomically decrement stock for MANUAL mode only (used at order-creation time).
 */
export function decrementManualStock(id: string, qty: number): Promise<{ count: number }> {
  return prisma.product.updateMany({
    where: { id, stockMode: 'manual', stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });
}

/** Append an audit-log entry (used for price changes). */
export function writeAuditLog(
  data: Prisma.AuditLogCreateInput,
): Promise<AuditLog> {
  return prisma.auditLog.create({ data });
}
