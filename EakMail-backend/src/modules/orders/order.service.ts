/**
 * Order business logic (BLUEPRINT.md §5). Owns:
 *  - createOrder: price the product + selected options, mint a deterministic idempotency
 *    key, and find-or-create the Order (never double-create on retry).
 *  - list / detail: paginated reads mapped to FE-safe DTOs.
 *  - manual retry: re-arm a FAILED/REFUND_PENDING order and re-enqueue fulfillment.
 *  - manual refund: enter the refund path for a failed-after-payment order.
 *
 * No HTTP objects and no Prisma queries inline — routes call this, this calls the
 * repositories (backend-guide.md §2).
 */
import type { OrderDetailDto, OrderDto, OrderStatus, Paginated } from '@eakmail/shared-types';
import { OrderStatus as OrderStates, StockMode } from '@eakmail/shared-types';
import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import { findById as findProductById, decrementManualStock } from '../products/product.repository.js';
import { refundService } from '../payments/index.js';
import { orderRepository } from './order.repository.js';
import { toOrderDetailDto, toOrderDto } from './order.mapper.js';
import {
  buildIdempotencyKey,
  computeOrderAmount,
  type SelectedOption,
} from './order.pricing.js';

const log = logger.child({ module: 'order-service' });

export interface CreateOrderInput {
  customerId: string;
  productId: string;
  /** How many units ordered (default 1). Used for MANUAL stock decrement. */
  quantity?: number;
  /** Ids of the ProductOption rows the customer selected (determines the unit price). */
  selectedOptionIds?: string[];
  /** Optional client token to distinguish deliberate re-orders of the same product. */
  idempotencyToken?: string;
}

export interface ListOrdersQuery {
  status?: OrderStatus;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const orderService = {
  /**
   * Create (or return the existing) order for a customer + product + option selection.
   * Idempotent: the deterministic key collapses retries; a race that loses the unique
   * insert re-reads the winner rather than erroring.
   */
  async createOrder(input: CreateOrderInput): Promise<OrderDto> {
    const product = await findProductById(input.productId);
    if (!product) throw new NotFoundError('Product');
    if (!product.active) throw new ValidationError('Product is not available');

    // Check manual stock before creating the order.
    const qty = input.quantity ?? 1;
    if (product.stockMode === StockMode.MANUAL && product.stock < qty) {
      throw new ValidationError('OUT_OF_STOCK');
    }

    const selected: SelectedOption[] = (input.selectedOptionIds ?? []).map((optionId) => ({
      optionId,
    }));

    let amount: number;
    try {
      amount = computeOrderAmount(product.price, product.options, selected);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid options');
    }

    const idempotencyKey = buildIdempotencyKey(
      input.customerId,
      input.productId,
      selected,
      input.idempotencyToken,
    );

    const existing = await orderRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return toOrderDto(existing);

    // Atomically decrement MANUAL stock at order-creation time — bail out if race lost.
    if (product.stockMode === StockMode.MANUAL) {
      const decremented = await decrementManualStock(product.id, qty);
      if (decremented.count === 0) {
        throw new ValidationError('OUT_OF_STOCK');
      }
    }

    try {
      const created = await orderRepository.create({
        customerId: input.customerId,
        productId: input.productId,
        amount,
        idempotencyKey,
      });
      log.info({ orderId: created.id, amount }, 'order created');
      return toOrderDto(created);
    } catch (err) {
      // Lost the create race: another request created the same idempotent order first.
      if (isUniqueViolation(err)) {
        const winner = await orderRepository.findByIdempotencyKey(idempotencyKey);
        if (winner) return toOrderDto(winner);
      }
      throw err;
    }
  },

  async listOrders(query: ListOrdersQuery): Promise<Paginated<OrderDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [rows, total] = await Promise.all([
      orderRepository.findAll(where, (page - 1) * pageSize, pageSize),
      orderRepository.count(where),
    ]);

    return { items: rows.map(toOrderDto), total, page, pageSize };
  },

  async getOrder(id: string): Promise<OrderDetailDto> {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');
    return toOrderDetailDto(order);
  },

  /**
   * Manual retry (admin): re-arm a failed order and re-enqueue fulfillment. Only allowed
   * from FAILED/REFUND_PENDING and only when no delivery has already succeeded — the
   * Delivery uniqueness guard is the ultimate exactly-once backstop, but we refuse early.
   */
  async retryOrder(id: string): Promise<OrderDto> {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');

    if (order.delivery) {
      throw new ConflictError('Order already delivered — retry not allowed');
    }
    if (
      order.status !== OrderStates.FAILED &&
      order.status !== OrderStates.REFUND_PENDING
    ) {
      throw new ConflictError(`Cannot retry an order in status ${order.status}`);
    }

    const rearmed = await orderRepository.resetForRetry(id);
    if (!rearmed) {
      // Someone else transitioned it concurrently; re-read and report the current state.
      const current = await orderRepository.findById(id);
      if (current) return toOrderDto(current);
      throw new NotFoundError('Order');
    }

    await getQueues()[QueueName.ORDER_FULFILLMENT].add(
      'fulfill',
      { orderId: id },
      // A retry is a new attempt: distinct jobId per attempt so BullMQ does not dedupe it
      // against the original fulfillment job, while the worker's own guards keep it safe.
      { jobId: `fulfill-${id}-retry-${Date.now()}` },
    );

    log.info({ orderId: id }, 'order manually re-armed for fulfillment');
    const updated = await orderRepository.findById(id);
    return toOrderDto(updated ?? order);
  },

  /**
   * Manual refund (admin): enter the refund path for a failed-after-payment order.
   * Moves FAILED → REFUND_PENDING (if needed) then settles via the payments refund service.
   * Idempotent: a repeated refund never double-credits or double-notifies.
   */
  async refundOrder(id: string, notifyText?: string): Promise<OrderDto> {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');

    if (
      order.status !== OrderStates.FAILED &&
      order.status !== OrderStates.REFUND_PENDING &&
      order.status !== OrderStates.PAID
    ) {
      throw new ConflictError(`Cannot refund an order in status ${order.status}`);
    }

    // Best-effort advance FAILED → REFUND_PENDING; markRefunded also accepts PAID directly.
    if (order.status === OrderStates.FAILED) {
      await orderRepository.markRefundPending(id);
    }

    await refundService.refundOrder({ orderId: id, notifyText });

    const updated = await orderRepository.findById(id);
    return toOrderDto(updated ?? order);
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
