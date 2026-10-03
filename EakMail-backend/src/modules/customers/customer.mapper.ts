/**
 * Maps Customer rows (+ aggregate order metrics) to FE-safe DTOs. Customers carry no secrets,
 * but we still shape explicitly so the wire contract stays exactly CustomerDto (no accidental
 * column leakage) — see .claude/rules/shared-types.md and ARCHITECTURE.md §10.
 */
import type { CustomerDto, CustomerStatsDto, Language } from '@eakmail/shared-types';
import { Language as Languages } from '@eakmail/shared-types';
import type {
  CustomerOrderStats,
  CustomerRecord,
  LanguageCount,
} from './customer.repository.js';

/** Zero metrics for a customer with no DELIVERED orders. */
const NO_ORDERS: CustomerOrderStats = { orderCount: 0, totalSpent: 0, lastOrderAt: null };

export function toCustomerDto(
  customer: CustomerRecord,
  orderStats: CustomerOrderStats = NO_ORDERS,
): CustomerDto {
  return {
    id: customer.id,
    telegramId: customer.telegramId,
    username: customer.username,
    firstName: customer.firstName,
    lastName: customer.lastName,
    language: customer.language as Language,
    balance: customer.balance,
    isBlocked: customer.isBlocked,
    orderCount: orderStats.orderCount,
    totalSpent: orderStats.totalSpent,
    lastOrderAt: orderStats.lastOrderAt ? orderStats.lastOrderAt.toISOString() : null,
    lastSeenAt: customer.lastSeenAt ? customer.lastSeenAt.toISOString() : null,
    createdAt: customer.createdAt.toISOString(),
  };
}

/**
 * Shape the summary counters. `byLanguage` is seeded with every supported language at 0 so the
 * DTO always carries a complete `Record<Language, number>`, then filled from the groupBy rows.
 */
export function toCustomerStatsDto(input: {
  totalCustomers: number;
  blockedCustomers: number;
  withOrders: number;
  languageCounts: LanguageCount[];
}): CustomerStatsDto {
  const byLanguage = Object.values(Languages).reduce(
    (acc, lang) => {
      acc[lang] = 0;
      return acc;
    },
    {} as Record<Language, number>,
  );

  for (const { language, count } of input.languageCounts) {
    if (language in byLanguage) byLanguage[language as Language] = count;
  }

  return {
    totalCustomers: input.totalCustomers,
    blockedCustomers: input.blockedCustomers,
    withOrders: input.withOrders,
    byLanguage,
  };
}
