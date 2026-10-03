/**
 * Orders module public surface (BLUEPRINT.md §5).
 * Consumers (routes, workers) import from here.
 */
export { orderService } from './order.service.js';
export type {
  CreateOrderInput,
  ListOrdersQuery,
} from './order.service.js';
export { orderRepository } from './order.repository.js';
export type {
  OrderRecord,
  OrderFulfillmentContext,
  CreateOrderData,
} from './order.repository.js';
export { toOrderDto, toOrderDetailDto } from './order.mapper.js';
export {
  computeOrderAmount,
  buildIdempotencyKey,
  type SelectedOption,
} from './order.pricing.js';
