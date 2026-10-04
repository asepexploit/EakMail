/**
 * /order handler — the buy flow (Phase 3a):
 *   1. parse the product id argument, validate the product is active + in stock,
 *   2. create a PENDING order (idempotent per customer+product+minute),
 *   3. show payment method selector (balance / QRIS if configured),
 *   4. callback handlers process the chosen method.
 *
 * Payment method selection:
 *   - "💰 Bayar dengan Saldo": deduct balance atomically → PAID → enqueue fulfillment.
 *   - "📱 QRIS / VA" (only shown when PAKASIR_API_KEY is set): create Pakasir transaction.
 *   - No Pakasir + no sufficient balance: shown as balance-only option with amount hint.
 *
 * When triggered from an inline-keyboard callback (catalog qty button), the catalog
 * message is edited to show the order confirmation instead of sending a new message.
 */
import type { Context } from 'telegraf';
import { PaymentMethod, StockMode, type PaymentDto } from '@eakmail/shared-types';
import { getProduct } from '../../../modules/products/product.service.js';
import { paymentService } from '../../../modules/payments/index.js';
import { orderRepository } from '../../../modules/orders/order.repository.js';
import { getQueues, QueueName } from '../../../queue/queues.js';
import { balanceService } from '../../../modules/customers/balance.service.js';
import { NotFoundError } from '../../../lib/errors.js';
import { logger } from '../../../lib/logger.js';
import { config } from '../../../config/index.js';
import { MessageKey } from '../i18n/keys.js';
import type { Translator } from '../i18n/index.js';
import { resolveBotContext, type BotContext } from '../context.js';
import * as botOrderRepository from '../order.repository.js';
import { formatRupiah, formatExpiry } from '../format.js';
import { invalidateCatalogCache } from './catalog.js';
import { paymentMethodKeyboard, PAY_ACTION_PREFIX } from '../keyboards.js';
import { generateQrPng } from '../qr.js';
import { setOrderQrMsg } from '../user-state.js';

const log = logger.child({ module: 'bot-order' });

function parseProductId(ctx: Context): string | null {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

function idempotencyKey(customerId: string, productId: string, quantity: number, optionId?: string): string {
  const now = new Date();
  const minuteBucket = now.toISOString().slice(0, 16);
  const optPart = optionId ? `:${optionId}` : '';
  return `bot:${customerId}:${productId}:${quantity}${optPart}:${minuteBucket}`;
}

function renderPaymentInstructions(payment: PaymentDto, tr: Translator, orderId: string): string {
  const blocks: string[] = [];
  if (payment.qrString) {
    // QR is rendered as an image — just show the label, not the raw string.
    blocks.push(tr(MessageKey.PAYMENT_QR_LABEL));
  } else if (payment.vaNumber) {
    blocks.push(tr(MessageKey.PAYMENT_VA, { vaNumber: payment.vaNumber }));
  } else if (payment.paymentUrl) {
    blocks.push(tr(MessageKey.PAYMENT_LINK, { paymentUrl: payment.paymentUrl }));
  }
  blocks.push(tr(MessageKey.PAYMENT_AMOUNT, { amount: formatRupiah(payment.amount) }));
  const expires = formatExpiry(payment.expiresAt);
  if (expires) blocks.push(tr(MessageKey.PAYMENT_EXPIRES, { expiresAt: expires }));
  blocks.push(tr(MessageKey.PAYMENT_PENDING_NOTE, { orderId }));
  return blocks.join('\n\n');
}

async function sendMessage(ctx: Context, text: string, extra?: object): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra as Parameters<typeof ctx.editMessageText>[1]);
      return;
    } catch { /* fall through to reply */ }
  }
  await ctx.reply(text, extra as Parameters<typeof ctx.reply>[1]);
}

export async function handleOrder(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const productId = parseProductId(ctx);
  if (!productId) {
    await ctx.reply(bot.tr(MessageKey.ORDER_USAGE));
    return;
  }

  await runOrderFlow(ctx, bot, productId, 1);
}

/**
 * Shared order flow, callable from the /order command and a catalog qty callback.
 * `optionId` is optional — when provided the selected option's fixed price is used and
 * the option key/value is stored in the order variables for the workflow engine.
 */
export async function runOrderFlow(
  ctx: Context,
  bot: BotContext,
  productId: string,
  quantity = 1,
  optionId?: string,
): Promise<void> {
  let product;
  try {
    product = await getProduct(productId);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await sendMessage(ctx, bot.tr(MessageKey.ORDER_PRODUCT_NOT_FOUND));
      return;
    }
    throw err;
  }

  if (!product.active) {
    await sendMessage(ctx, bot.tr(MessageKey.ORDER_PRODUCT_INACTIVE));
    return;
  }

  if (product.stockMode === StockMode.MANUAL) {
    if (product.stock < quantity) {
      const msg = product.stock === 0
        ? bot.tr(MessageKey.ORDER_OUT_OF_STOCK)
        : bot.tr(MessageKey.ORDER_INSUFFICIENT_STOCK, { available: product.stock });
      await sendMessage(ctx, msg);
      return;
    }
  } else if (
    product.stockMode === StockMode.STOCK_ONLY ||
    product.stockMode === StockMode.STOCK_WITH_FALLBACK ||
    product.stockMode === StockMode.STOCK_WITH_API_FALLBACK
  ) {
    const { stockRepository } = await import('../../../modules/products/stock.repository.js');
    const available = await stockRepository.countAvailable(product.id);
    if (available < quantity) {
      const msg = available === 0
        ? bot.tr(MessageKey.ORDER_OUT_OF_STOCK)
        : bot.tr(MessageKey.ORDER_INSUFFICIENT_STOCK, { available });
      await sendMessage(ctx, msg);
      return;
    }
  }

  // Resolve selected option (if any). Option price overrides base price when set.
  const selectedOption = optionId ? product.options.find((o) => o.id === optionId) : undefined;
  const unitPrice = selectedOption && selectedOption.price > 0
    ? selectedOption.price
    : product.price;
  const totalAmount = unitPrice * quantity;

  const order = await botOrderRepository.createPendingOrder({
    customerId: bot.customer.id,
    productId: product.id,
    quantity,
    amount: totalAmount,
    idempotencyKey: idempotencyKey(bot.customer.id, product.id, quantity, optionId),
    optionKey: selectedOption?.key,
    optionValue: selectedOption?.value,
  });

  const isPaymentConfigured = Boolean(config.PAKASIR_API_KEY);
  const balance = bot.customer.balance;

  const methodText = bot.tr(MessageKey.ORDER_CHOOSE_PAYMENT_METHOD, {
    productName: selectedOption
      ? `${product.name} — ${selectedOption.value}`
      : product.name,
    qty: quantity > 1 ? ` ×${quantity}` : '',
    amount: formatRupiah(totalAmount),
    balance: formatRupiah(balance),
  });
  const keyboard = paymentMethodKeyboard(order.id, balance, isPaymentConfigured, bot.tr);
  await sendMessage(ctx, methodText, keyboard);
  log.info(
    { orderId: order.id, quantity, optionId, unitPrice, balance, isPaymentConfigured },
    'order created, awaiting payment method',
  );
}

/**
 * Handle "pay:balance:<orderId>" callback.
 * Deduct balance atomically → PAID → enqueue fulfillment.
 */
export async function handlePayBalance(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  const parts = data.split(':'); // ["pay","balance","<orderId>"]
  const orderId = parts[2];
  if (!orderId) return;

  const order = await botOrderRepository.findCustomerOrder(orderId, bot.customer.id);
  if (!order || order.status !== 'PENDING') {
    await ctx.answerCbQuery('Pesanan tidak ditemukan atau sudah diproses.');
    return;
  }

  const insufficientText = bot.tr(MessageKey.ORDER_BALANCE_INSUFFICIENT, {
    balance: formatRupiah(bot.customer.balance),
    amount: formatRupiah(order.amount),
  });
  const isPaymentConfigured = Boolean(config.PAKASIR_API_KEY);

  if (bot.customer.balance < order.amount) {
    await ctx.answerCbQuery();
    if (isPaymentConfigured) {
      await ctx.editMessageText(insufficientText, paymentMethodKeyboard(order.id, 0, true, bot.tr, false));
    } else {
      await ctx.editMessageText(insufficientText);
    }
    return;
  }

  // Atomic: deduct balance + mark order PAID.
  const sufficient = await balanceService.deductForPurchase(bot.customer.id, order.amount, orderId);
  if (!sufficient) {
    await ctx.answerCbQuery();
    if (isPaymentConfigured) {
      await ctx.editMessageText(insufficientText, paymentMethodKeyboard(order.id, 0, true, bot.tr, false));
    } else {
      await ctx.editMessageText(insufficientText);
    }
    return;
  }

  // Decrement stock on PAID (manual stock mode only)
  const isManualStock = order.product.stockMode === StockMode.MANUAL;
  const paid = await orderRepository.markPaid(orderId, isManualStock ? order.quantity : 0);
  if (paid) {
    if (isManualStock) invalidateCatalogCache();
    await getQueues()[QueueName.ORDER_FULFILLMENT].add(
      'fulfill',
      { orderId },
      { jobId: `fulfill-${orderId}` },
    );
  }

  // Fetch fresh balance after deduction.
  const { prisma } = await import('../../../db/client.js');
  const freshCustomer = await prisma.customer.findUnique({ where: { id: bot.customer.id }, select: { balance: true } });
  const newBalance = freshCustomer?.balance ?? 0;

  await ctx.answerCbQuery('✅ Pembayaran berhasil!');
  await ctx.editMessageText(
    bot.tr(MessageKey.ORDER_BALANCE_PAID, {
      productName: order.product.name,
      amount: formatRupiah(order.amount),
      newBalance: formatRupiah(newBalance),
    }),
  );
  log.info({ orderId, customerId: bot.customer.id, amount: order.amount }, 'order paid via balance');
}

/**
 * Handle "pay:qris:<orderId>" callback.
 * Create a Pakasir transaction and show payment instructions.
 */
export async function handlePayQris(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  const parts = data.split(':');
  const orderId = parts[2];
  if (!orderId) return;

  const order = await botOrderRepository.findCustomerOrder(orderId, bot.customer.id);
  if (!order || order.status !== 'PENDING') {
    await ctx.answerCbQuery('Pesanan tidak ditemukan atau sudah diproses.');
    return;
  }

  await ctx.answerCbQuery();

  const payment = await paymentService.createTransaction({
    orderId: order.id,
    method: PaymentMethod.QRIS,
  });

  const paymentText = renderPaymentInstructions(payment, bot.tr, order.id);

  if (payment.qrString) {
    // Send QR as image — delete the keyboard message first, then send photo + instructions.
    try { await ctx.deleteMessage(); } catch { /* best-effort */ }
    const qrPng = await generateQrPng(payment.qrString);
    const sent = await ctx.replyWithPhoto(
      { source: qrPng, filename: 'qris.png' },
      { caption: paymentText, parse_mode: 'Markdown' },
    );
    if (sent.chat.id && sent.message_id) {
      void setOrderQrMsg(order.id, sent.chat.id, sent.message_id);
    }
  } else {
    await ctx.editMessageText(paymentText, { parse_mode: 'Markdown' });
  }
  log.info({ orderId, method: payment.method }, 'bot order → QRIS payment issued');
}

/** Route "pay:*" callback_data to the correct handler. */
export async function handlePayCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  const parts = data.split(':');
  const method = parts[1];
  if (method === 'balance') return handlePayBalance(ctx);
  if (method === 'qris') return handlePayQris(ctx);
  await ctx.answerCbQuery('Metode tidak dikenal.');
}

export { PAY_ACTION_PREFIX };
