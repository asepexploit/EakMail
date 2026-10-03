/**
 * Customer data access (Prisma only — no HTTP, no business decisions).
 * Owns paginated/filtered reads of Customer rows, single-row lookup, admin updates
 * (block / balance), and the aggregate order metrics the dashboard shows. Order metrics
 * (count, total spent, last order) are derived from DELIVERED orders only, so refunded or
 * failed orders never inflate a customer's lifetime value (ARCHITECTURE.md §11).
 */
import type { Prisma } from '@prisma/client';
import { OrderStatus } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';

export type CustomerRecord = Prisma.CustomerGetPayload<Record<string, never>>;

/** Per-customer aggregate over that customer's DELIVERED orders. */
export interface CustomerOrderStats {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

export interface UpdateCustomerData {
  isBlocked?: boolean;
  balance?: number;
}

/** Language-keyed customer counts (rows Prisma returns from a groupBy over Customer). */
export interface LanguageCount {
  language: string;
  count: number;
}

export const customerRepository = {
  findAll(where: Prisma.CustomerWhereInput, skip: number, take: number): Promise<CustomerRecord[]> {
    return prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  count(where: Prisma.CustomerWhereInput): Promise<number> {
    return prisma.customer.count({ where });
  },

  findById(id: string): Promise<CustomerRecord | null> {
    return prisma.customer.findUnique({ where: { id } });
  },

  update(id: string, data: UpdateCustomerData): Promise<CustomerRecord> {
    return prisma.customer.update({ where: { id }, data });
  },

  /**
   * Aggregate DELIVERED-order metrics for a set of customers in a single groupBy, so listing
   * a page of N customers costs one extra query rather than N. Returns a map keyed by
   * customerId; a customer with no delivered orders is simply absent (caller defaults to 0).
   */
  async orderStatsByCustomer(customerIds: string[]): Promise<Map<string, CustomerOrderStats>> {
    const stats = new Map<string, CustomerOrderStats>();
    if (customerIds.length === 0) return stats;

    const rows = await prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: OrderStatus.DELIVERED },
      _count: { _all: true },
      _sum: { amount: true },
      _max: { createdAt: true },
    });

    for (const row of rows) {
      stats.set(row.customerId, {
        orderCount: row._count._all,
        totalSpent: row._sum.amount ?? 0,
        lastOrderAt: row._max.createdAt ?? null,
      });
    }
    return stats;
  },

  // ---- stats (dashboard summary) --------------------------------------------

  countAll(): Promise<number> {
    return prisma.customer.count();
  },

  countBlocked(): Promise<number> {
    return prisma.customer.count({ where: { isBlocked: true } });
  },

  /** Number of distinct customers who have at least one DELIVERED order. */
  async countWithOrders(): Promise<number> {
    const rows = await prisma.order.groupBy({
      by: ['customerId'],
      where: { status: OrderStatus.DELIVERED },
    });
    return rows.length;
  },

  /** Customer counts grouped by language (for the byLanguage breakdown). */
  async countByLanguage(): Promise<LanguageCount[]> {
    const rows = await prisma.customer.groupBy({
      by: ['language'],
      _count: { _all: true },
    });
    return rows.map((row) => ({ language: row.language, count: row._count._all }));
  },
};
