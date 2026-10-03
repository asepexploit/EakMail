/**
 * Customer business logic (storefront users). Owns:
 *  - list: paginated + filtered reads (search by username / telegramId / name, filter by
 *    language and blocked flag), enriched with per-customer DELIVERED-order metrics.
 *  - stats: the dashboard summary (totals, blocked, with-orders, per-language breakdown).
 *  - detail: single customer with its order metrics.
 *  - update: admin block/unblock and balance adjustment.
 *
 * No HTTP objects and no Prisma queries inline — routes call this, this calls the repository
 * (backend-guide.md §2).
 */
import type {
  CustomerDto,
  CustomerStatsDto,
  Language,
  Paginated,
} from '@eakmail/shared-types';
import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';
import { customerRepository, type UpdateCustomerData } from './customer.repository.js';
import { toCustomerDto, toCustomerStatsDto } from './customer.mapper.js';

export interface ListCustomersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  language?: Language;
  blocked?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Build the Prisma where-clause from the list filters. Search matches username, telegram id,
 *  first name or last name (case-insensitive substring). */
function buildWhere(query: ListCustomersQuery): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};

  if (query.language) where.language = query.language;
  if (query.blocked !== undefined) where.isBlocked = query.blocked;

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { telegramId: { contains: search } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export const customerService = {
  async listCustomers(query: ListCustomersQuery): Promise<Paginated<CustomerDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const where = buildWhere(query);

    const [rows, total] = await Promise.all([
      customerRepository.findAll(where, (page - 1) * pageSize, pageSize),
      customerRepository.count(where),
    ]);

    // One aggregate query for the whole page's DELIVERED-order metrics (avoids N+1).
    const stats = await customerRepository.orderStatsByCustomer(rows.map((r) => r.id));

    const items = rows.map((row) => toCustomerDto(row, stats.get(row.id)));
    return { items, total, page, pageSize };
  },

  async getCustomer(id: string): Promise<CustomerDto> {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new NotFoundError('Customer');

    const stats = await customerRepository.orderStatsByCustomer([id]);
    return toCustomerDto(customer, stats.get(id));
  },

  async updateCustomer(id: string, data: UpdateCustomerData): Promise<CustomerDto> {
    const existing = await customerRepository.findById(id);
    if (!existing) throw new NotFoundError('Customer');

    const updated = await customerRepository.update(id, data);
    const stats = await customerRepository.orderStatsByCustomer([id]);
    return toCustomerDto(updated, stats.get(id));
  },

  async getStats(): Promise<CustomerStatsDto> {
    const [totalCustomers, blockedCustomers, withOrders, languageCounts] = await Promise.all([
      customerRepository.countAll(),
      customerRepository.countBlocked(),
      customerRepository.countWithOrders(),
      customerRepository.countByLanguage(),
    ]);

    return toCustomerStatsDto({ totalCustomers, blockedCustomers, withOrders, languageCounts });
  },
};
