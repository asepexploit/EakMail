/**
 * Customers module public surface (storefront users).
 * Consumers (routes, workers) import from here.
 */
export { customerService } from './customer.service.js';
export type { ListCustomersQuery } from './customer.service.js';
export { customerRepository } from './customer.repository.js';
export type {
  CustomerRecord,
  CustomerOrderStats,
  UpdateCustomerData,
  LanguageCount,
} from './customer.repository.js';
export { toCustomerDto, toCustomerStatsDto } from './customer.mapper.js';
