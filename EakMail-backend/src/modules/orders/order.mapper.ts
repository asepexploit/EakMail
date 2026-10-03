/**
 * Maps Order rows to FE-safe DTOs. Never exposes the encrypted delivery payload or any
 * secret (ARCHITECTURE.md §10) — the delivered goods are customer-only, so OrderDetailDto
 * carries only the delivery timestamp, not the payload.
 */
import type { OrderDetailDto, OrderDto } from '@eakmail/shared-types';
import type { OrderStatus } from '@eakmail/shared-types';
import { toPaymentDto } from '../payments/payment.mapper.js';
import type { OrderRecord } from './order.repository.js';

export function toOrderDto(order: OrderRecord): OrderDto {
  const c = order.customer;
  const customerName = c.firstName
    ? [c.firstName, c.lastName].filter(Boolean).join(' ')
    : c.username
      ? `@${c.username}`
      : null;

  return {
    id: order.id,
    customerId: order.customerId,
    productId: order.productId,
    productName: order.product.name,
    customerName,
    quantity: order.quantity,
    amount: order.amount,
    status: order.status as OrderStatus,
    executionId: order.executions[0]?.id ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

export function toOrderDetailDto(order: OrderRecord): OrderDetailDto {
  return {
    ...toOrderDto(order),
    payment: order.payment ? toPaymentDto(order.payment) : null,
    deliveredAt: order.delivery ? order.delivery.deliveredAt.toISOString() : null,
  };
}
