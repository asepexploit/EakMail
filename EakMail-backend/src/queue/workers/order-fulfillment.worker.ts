/**
 * Order fulfillment worker (BLUEPRINT.md §5.1, TASKS.md Phase 5).
 *
 * Consumes `order-fulfillment` jobs and drives one order to DELIVERED or FAILED:
 *   resolve order → product → workflow + supplier + account
 *   → guard PAID → FULFILLING (once)
 *   → open conversation + run the engine interpreter
 *   → on success: persist encrypted Delivery (exactly-once) → DELIVERED → notify customer
 *   → on failure: FAILED → REFUND_PENDING → refund path (notify customer)
 *
 * Idempotency is layered:
 *   1. an advisory Redis lock serializes concurrent runs of the same order,
 *   2. the PAID→FULFILLING guard admits only one run,
 *   3. the unique Delivery row is the hard exactly-once delivery gate.
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { encrypt } from '../../lib/crypto.js';
import { WorkflowError } from '../../lib/errors.js';
import {
  bullConnection,
  QueueName,
  getQueues,
  type OrderFulfillmentJob,
} from '../queues.js';
import { orderRepository } from '../../modules/orders/order.repository.js';
import { refundService } from '../../modules/payments/index.js';
import { resolveFulfillment, type ResolvedFulfillment } from './fulfillment-context.js';
import { runWorkflowExecution } from './execution-runner.js';
import { acquireLock, orderLockKey } from './lock.js';
import { stockRepository } from '../../modules/products/stock.repository.js';
import * as productRepository from '../../modules/products/product.repository.js';
import { renderTemplate } from '../../workflow/variables.js';
import { getStorefrontSender } from './storefront-sender.js';
import { t } from '../../telegram/bot/i18n/index.js';
import { MessageKey } from '../../telegram/bot/i18n/keys.js';
import type { Language } from '@eakmail/shared-types';
import { balanceService } from '../../modules/customers/balance.service.js';
import { prisma } from '../../db/client.js';
import type { WorkerBuildDeps } from './types.js';
import { getApiSupplierConfig } from '../../modules/suppliers/supplier.service.js';
import { checkApiStock, placeApiOrder } from '../../modules/suppliers/api-supplier.service.js';

const log = logger.child({ module: 'order-fulfillment-worker' });

/** Lock TTL: generous upper bound on one fulfillment run (bots can be slow). */
const LOCK_TTL_MS = 5 * 60 * 1000;

/** Build (but do not implicitly start elsewhere) the order-fulfillment worker. */
export function buildOrderFulfillmentWorker(deps: WorkerBuildDeps = {}): Worker<OrderFulfillmentJob> {
  return new Worker<OrderFulfillmentJob>(
    QueueName.ORDER_FULFILLMENT,
    (job) => processFulfillment(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 5,
      ...(deps.limiter ? { limiter: deps.limiter } : {}),
    },
  );
}

/** Process a single fulfillment job. Throwing lets BullMQ retry per queue config. */
async function processFulfillment(job: Job<OrderFulfillmentJob>): Promise<void> {
  const { orderId } = job.data;

  const lock = await acquireLock(orderLockKey(orderId), LOCK_TTL_MS);
  if (!lock) {
    log.info({ orderId }, 'fulfillment already in progress — skipping duplicate');
    return;
  }

  try {
    // Fast exit if a prior run already delivered this order (exactly-once).
    const existingDelivery = await orderRepository.findDelivery(orderId);
    if (existingDelivery) {
      log.info({ orderId }, 'order already delivered — skipping');
      return;
    }

    // Admit exactly one run: PAID → FULFILLING. A replay finds it already moved.
    const started = await orderRepository.startFulfilling(orderId);
    if (!started) {
      const order = await orderRepository.findById(orderId);
      log.info({ orderId, status: order?.status }, 'order not in PAID state — skipping');
      return;
    }

    // Send "preparing your order" notice to the customer immediately after FULFILLING starts.
    // Fire-and-forget — a failed notice must never block fulfillment.
    void sendFulfillingNotice(orderId);

    await fulfill(orderId);
  } finally {
    await lock.release();
  }
}

/**
 * Send a "we are preparing your order" notice to the customer as soon as FULFILLING starts.
 * Runs fire-and-forget so a Telegram hiccup cannot block or fail the actual fulfillment.
 */
async function sendFulfillingNotice(orderId: string): Promise<void> {
  try {
    const context = await orderRepository.findForFulfillment(orderId);
    if (!context) return;
    const lang = (context.customer.language as Language) ?? 'id';
    const text = t(MessageKey.FULFILLING_NOTICE, lang);
    await getStorefrontSender().sendText(context.customer.telegramId, text);
  } catch (err) {
    log.warn({ orderId, err }, 'fulfilling notice failed — continuing anyway');
  }
}

/** Resolve, run the workflow, and settle the order based on the terminal result. */
async function fulfill(orderId: string): Promise<void> {
  const context = await orderRepository.findForFulfillment(orderId);
  if (!context) {
    await failAndRefund(orderId, 'Order disappeared during fulfillment');
    return;
  }

  const stockMode = context.product.stockMode;
  const quantity = context.quantity;
  const productId = context.productId;

  // Safety net: ANY unexpected error must settle into FAILED → REFUND_PENDING.
  try {
    // STOCK_ONLY: serve from local stock, fail if empty.
    if (stockMode === 'stock_only') {
      await fulfillFromStock(orderId, productId, quantity, context.customer.telegramId, false);
      return;
    }

    // API_SUPPLIER: call the external REST API supplier directly — no workflow needed.
    if (stockMode === 'api_supplier') {
      await fulfillFromApiSupplier(orderId, context);
      return;
    }

    // STOCK_WITH_API_FALLBACK: local stock first; if empty, fall back to API supplier.
    if (stockMode === 'stock_with_api_fallback') {
      const available = await stockRepository.countAvailable(productId);
      if (available >= quantity) {
        log.info({ orderId, available, quantity }, 'stock_with_api_fallback — using local stock');
        await fulfillFromStock(orderId, productId, quantity, context.customer.telegramId, false);
      } else {
        log.info({ orderId, available, quantity }, 'stock_with_api_fallback — local stock insufficient, falling back to API');
        await fulfillFromApiSupplier(orderId, context);
      }
      return;
    }

    // STOCK_WITH_FALLBACK: local stock first, workflow if empty.
    if (stockMode === 'stock_with_fallback') {
      const available = await stockRepository.countAvailable(productId);
      if (available >= quantity) {
        await fulfillFromStock(orderId, productId, quantity, context.customer.telegramId, false);
        return;
      }
      log.info({ orderId, available, quantity }, 'stock insufficient — falling back to workflow');
    }

    // WORKFLOW / manual / unlimited / fallback path: run the supplier workflow.
    let resolved;
    try {
      resolved = resolveFulfillment(context);
    } catch (err) {
      const reason = err instanceof WorkflowError ? err.message : 'Fulfillment mapping failed';
      log.warn({ orderId, err }, 'fulfillment mapping failed');
      await failAndRefund(orderId, reason);
      return;
    }

    if (quantity <= 1) {
      await fulfillSingle(orderId, resolved);
    } else {
      await fulfillMultiple(orderId, quantity, resolved);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unexpected fulfillment error';
    log.error({ orderId, err }, 'fulfillment crashed — forcing failure');
    await failAndRefund(orderId, reason);
  }
}

/** Fulfill an order entirely from local stock items. */
async function fulfillFromStock(
  orderId: string,
  productId: string,
  quantity: number,
  customerTelegramId: string,
  _fallback: boolean,
): Promise<void> {
  const payloads = await stockRepository.popItems(productId, orderId, quantity);
  if (!payloads) {
    await failAndRefund(orderId, 'Stok habis');
    return;
  }

  // Apply per-product delivery template if set; otherwise join payloads with newlines.
  const product = await productRepository.findById(productId);
  let text: string;
  if (product?.deliveryTemplate) {
    text = renderTemplate(product.deliveryTemplate, {
      payload: payloads.join('\n'),
      payloads,
      quantity: payloads.length,
    });
  } else {
    text = payloads.join('\n');
  }

  await deliver(orderId, customerTelegramId, text);
}

/**
 * Fulfill via the product's linked API supplier — HTTP call to the external store.
 * Requires: product.supplierId, supplier.supplierType === 'api', apiKeyEnc set.
 */
async function fulfillFromApiSupplier(
  orderId: string,
  context: NonNullable<Awaited<ReturnType<typeof orderRepository.findForFulfillment>>>,
): Promise<void> {
  const supplierId = context.product.supplierId;
  if (!supplierId) {
    await failAndRefund(orderId, 'Produk API supplier tidak punya supplierId');
    return;
  }

  const apiConfig = await getApiSupplierConfig(supplierId);
  if (!apiConfig) {
    await failAndRefund(orderId, 'Konfigurasi API supplier tidak ditemukan atau tidak lengkap');
    return;
  }

  const externalProductId = context.product.externalProductId;
  if (!externalProductId) {
    await failAndRefund(orderId, 'Produk tidak punya externalProductId — sync ulang dari supplier');
    return;
  }

  try {
    // Check stock before placing the order to avoid wasting supplier balance on an empty product.
    const apiStock = await checkApiStock(apiConfig, externalProductId);
    if (apiStock === 0) {
      await failAndRefund(orderId, 'Stok produk di supplier habis');
      return;
    }
    if (apiStock !== -1 && apiStock < context.quantity) {
      await failAndRefund(orderId, `Stok supplier tidak cukup (tersedia: ${apiStock}, diminta: ${context.quantity})`);
      return;
    }

    const result = await placeApiOrder(apiConfig, externalProductId, context.quantity);
    log.info({ orderId, externalOrderId: result.orderId }, 'API supplier order placed');

    // Apply delivery template if configured; otherwise send the raw payload.
    const template = context.product.deliveryTemplate;
    const text = template
      ? renderTemplate(template, {
          payload: result.payload,
          payloads: result.payload.split('\n'),
          quantity: context.quantity,
        })
      : result.payload;

    await deliver(orderId, context.customer.telegramId, text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'API supplier order failed';
    log.warn({ orderId, supplierId, err }, 'API supplier fulfillment failed');
    await failAndRefund(orderId, reason);
  }
}

/** Run the workflow once (quantity=1 fast path). */
async function fulfillSingle(
  orderId: string,
  resolved: ResolvedFulfillment,
): Promise<void> {
  const controller = new AbortController();

  const { executionId, result } = await runWorkflowExecution({
    workflowId: resolved.workflowId,
    graph: resolved.graph,
    orderId,
    accountId: resolved.accountId,
    peer: resolved.peer,
    mode: 'PRODUCTION',
    variables: resolved.variables,
    signal: controller.signal,
  });

  if (result.state === 'SUCCEEDED') {
    await deliver(orderId, resolved.customerTelegramId, result.terminal?.payload ?? result.variables);
    return;
  }

  const reason = result.terminal?.reason ?? `Execution ended ${result.state}`;
  log.warn({ orderId, executionId, state: result.state }, 'fulfillment failed');
  if (result.terminal?.refund !== false) {
    await failAndRefund(orderId, reason);
  } else {
    await orderRepository.markFailed(orderId);
  }
}

/**
 * Run the workflow `quantity` times sequentially, collecting each delivery payload.
 * Each iteration sets `{{itemIndex}}` (1-based) so the workflow template can reference it.
 * If any iteration fails, the entire order fails into the refund path.
 */
async function fulfillMultiple(
  orderId: string,
  quantity: number,
  resolved: ResolvedFulfillment,
): Promise<void> {
  const payloads: string[] = [];
  const controller = new AbortController();

  for (let i = 1; i <= quantity; i++) {
    const iterationVars = {
      ...resolved.variables,
      itemIndex: i,
      itemTotal: quantity,
    };

    const { executionId, result } = await runWorkflowExecution({
      workflowId: resolved.workflowId,
      graph: resolved.graph,
      orderId,
      accountId: resolved.accountId,
      peer: resolved.peer,
      mode: 'PRODUCTION',
      variables: iterationVars,
      signal: controller.signal,
    });

    if (result.state !== 'SUCCEEDED') {
      const reason = result.terminal?.reason ?? `Execution ended ${result.state} on item ${i}/${quantity}`;
      log.warn({ orderId, executionId, item: i, quantity, state: result.state }, 'fulfillment iteration failed');
      await failAndRefund(orderId, reason);
      return;
    }

    const payload = result.terminal?.payload ?? result.variables;
    payloads.push(renderDeliveryText(payload));
    log.info({ orderId, item: i, quantity }, 'fulfillment iteration succeeded');
  }

  const combined = payloads.join('\n---\n');
  await deliver(orderId, resolved.customerTelegramId, combined);
}

/**
 * Persist the encrypted delivery payload (exactly-once), mark DELIVERED, and hand the goods
 * to the customer via the notifications queue. If the Delivery already exists (a race), we
 * do not send a second copy.
 */
async function deliver(
  orderId: string,
  customerTelegramId: string,
  payload: unknown,
): Promise<void> {
  const text = renderDeliveryText(payload);
  const outcome = await orderRepository.createDelivery(orderId, encrypt(text));
  if (outcome === 'duplicate') {
    log.info({ orderId }, 'delivery already recorded — not re-sending');
    await orderRepository.markDelivered(orderId);
    return;
  }

  // Decrement stock counter if the product has stock tracking enabled (stock > 0, any mode).
  // MANUAL mode stock was already decremented at order creation; other modes decrement here.
  try {
    const order = await orderRepository.findById(orderId);
    if (order) {
      const product = await productRepository.findById(order.productId);
      if (product && product.stockMode !== 'manual' && product.stock > 0) {
        await productRepository.decrementStock(order.productId, order.quantity);
        log.info({ orderId, productId: order.productId, qty: order.quantity }, 'stock decremented after delivery');
      }
    }
  } catch (err) {
    log.warn({ orderId, err }, 'stock decrement after delivery failed — non-fatal');
  }

  // Enqueue the customer-send BEFORE flipping DELIVERED. If the queue add throws (Redis blip),
  // we throw out and leave the order in FULFILLING — the worker safety-net in fulfill() routes
  // it to the refund path, which is far better than a DELIVERED row with no message ever sent.
  // The notification jobId dedupes a retried enqueue, and the Delivery row dedupes the content.
  await getQueues()[QueueName.NOTIFICATIONS].add(
    'deliver',
    { customerTelegramId, text },
    { jobId: `deliver-${orderId}` },
  );

  await orderRepository.markDelivered(orderId);
  log.info({ orderId }, 'order delivered');
}

/** FAILED → REFUND_PENDING → refund. Idempotent via the guarded transitions. */
async function failAndRefund(orderId: string, reason: string): Promise<void> {
  await orderRepository.markFailed(orderId);
  await orderRepository.markRefundPending(orderId);

  // If the order was paid via balance, return the amount to the customer's balance instead of
  // going through the Pakasir refund flow.
  const balanceTx = await prisma.balanceTransaction.findFirst({
    where: { orderId, type: 'purchase' },
    select: { customerId: true, amount: true },
  });

  if (balanceTx) {
    // Refund to balance — amount stored as negative debit, so refund is its positive inverse.
    await balanceService.refundToBalance(balanceTx.customerId, -balanceTx.amount, orderId);
    await orderRepository.markRefunded(orderId);
    log.info({ orderId, reason, customerId: balanceTx.customerId }, 'order failed → balance refunded');
    return;
  }

  // Localized customer copy is owned by the bot i18n catalog; the refund service enqueues a
  // notification only when given text. Here we pass none (admin UI / bot layer localizes on
  // its own status view). The reason is recorded in logs + execution steps.
  await refundService.refundOrder({ orderId });
  log.info({ orderId, reason }, 'order failed → refund path entered');
}

/** Reduce a terminal payload to the text delivered to the customer. */
function renderDeliveryText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    return JSON.stringify(payload);
  }
  return String(payload ?? '');
}
