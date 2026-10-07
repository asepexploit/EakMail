/**
 * Order flow EakTele.
 * Alur: pilih produk → ketik jumlah → pilih metode bayar → proses → kirim detail akun.
 */
import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { S } from '../i18n/strings.js';
import { deliveryKeyboard, insufficientBalanceKeyboard, ACTION } from '../keyboards.js';
import { productDisplayLabel } from './catalog.js';
import { getProduct } from '../../../modules/products/product.service.js';
import { orderRepository } from '../../../modules/orders/order.repository.js';
import { balanceService } from '../../../modules/customers/balance.service.js';
import { stockService } from '../../../modules/eaktele/stock.service.js';
import { stockRepository } from '../../../modules/eaktele/stock.repository.js';
import { getOrCreateByTelegramId } from '../../bot/customer.repository.js';
import { logger } from '../../../lib/logger.js';

const log = logger.child({ module: 'eaktele-order' });

// ── In-memory state ────────────────────────────────────────────────────────────

interface QtyState {
  productId: string;
  displayName: string;
  price: number;
  available: number;
}

interface PaymentState {
  productId: string;
  displayName: string;
  price: number;
  qty: number;
}

const awaitingQty = new Map<number, QtyState>();
const awaitingPayment = new Map<number, PaymentState>();

export function setAwaitingQty(userId: number, state: QtyState): void {
  awaitingQty.set(userId, state);
}
export function getAwaitingQty(userId: number): QtyState | undefined {
  return awaitingQty.get(userId);
}
export function clearAwaitingQty(userId: number): void {
  awaitingQty.delete(userId);
}
function clearAll(userId: number): void {
  awaitingQty.delete(userId);
  awaitingPayment.delete(userId);
}

// ── Step 1: Buy button → minta jumlah ─────────────────────────────────────────

export async function handleOrderStartBuy(ctx: Context, productId: string): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const product = await getProduct(productId);
  const counts = await stockRepository.countByStatus(productId);
  const available = counts.AVAILABLE ?? 0;

  if (available === 0) {
    await ctx.editMessageText(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
    return;
  }

  const displayName = productDisplayLabel(product.name);
  setAwaitingQty(ctx.from.id, { productId, displayName, price: product.price, available });

  await ctx.editMessageText(
    S.ORDER_QTY_PROMPT(displayName, product.price, available),
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(S.BTN_CANCEL, ACTION.ORDER_CANCEL)],
      ]).reply_markup,
    },
  );
}

// ── Step 2: User ketik jumlah → tampil pilihan metode bayar ───────────────────

export async function handleQtyInput(ctx: Context): Promise<boolean> {
  if (!ctx.from || !('text' in (ctx.message ?? {}))) return false;
  const state = getAwaitingQty(ctx.from.id);
  if (!state) return false;

  const text = (ctx.message as { text: string }).text.trim();
  if (text.startsWith('/')) return false;

  const qty = parseInt(text, 10);
  if (isNaN(qty) || qty < 1) {
    await ctx.reply(S.ORDER_QTY_INVALID, { parse_mode: 'Markdown' });
    return true;
  }
  if (qty > state.available) {
    await ctx.reply(S.ORDER_QTY_EXCEED(state.available), { parse_mode: 'Markdown' });
    return true;
  }

  clearAwaitingQty(ctx.from.id);

  // Simpan state untuk step pembayaran
  awaitingPayment.set(ctx.from.id, {
    productId: state.productId,
    displayName: state.displayName,
    price: state.price,
    qty,
  });

  const totalPrice = state.price * qty;

  await ctx.reply(
    S.ORDER_PAYMENT_SELECT(state.displayName, state.price, qty, totalPrice),
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(S.BTN_PAY_BALANCE, ACTION.ORDER_PAY_BALANCE_CONFIRM)],
        [Markup.button.callback(S.BTN_PAY_QRIS, ACTION.ORDER_PAY_QRIS_CONFIRM)],
        [Markup.button.callback(S.BTN_CANCEL, ACTION.ORDER_CANCEL)],
      ]).reply_markup,
    },
  );
  return true;
}

// ── Step 3a: Bayar via saldo ───────────────────────────────────────────────────

export async function handleConfirmPayBalance(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const state = awaitingPayment.get(ctx.from.id);
  if (!state) {
    await ctx.editMessageText(S.ERROR_GENERIC, { parse_mode: 'Markdown' });
    return;
  }

  awaitingPayment.delete(ctx.from.id);

  const customer = await getOrCreateByTelegramId(String(ctx.from.id));
  const totalPrice = state.price * state.qty;

  if (customer.balance < totalPrice) {
    await ctx.editMessageText(
      S.ORDER_INSUFFICIENT(state.displayName, state.price, state.qty, customer.balance),
      { parse_mode: 'Markdown', ...insufficientBalanceKeyboard() },
    );
    return;
  }

  await ctx.editMessageText(S.ORDER_PROCESSING, { parse_mode: 'Markdown' });
  await processBalanceOrder(ctx, state.productId, state.displayName, state.price, state.qty);
}

// ── Step 3b: QRIS — belum diimplementasi ──────────────────────────────────────

export async function handleConfirmPayQris(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();
  awaitingPayment.delete(ctx.from.id);
  await ctx.editMessageText(S.ORDER_QRIS_COMING_SOON, { parse_mode: 'Markdown' });
}

// ── Process order (internal) ───────────────────────────────────────────────────

async function processBalanceOrder(
  ctx: Context,
  productId: string,
  displayName: string,
  price: number,
  qty: number,
): Promise<void> {
  if (!ctx.from) return;

  const customer = await getOrCreateByTelegramId(String(ctx.from.id));
  const results: { orderId: string; stockId: string }[] = [];

  for (let i = 0; i < qty; i++) {
    const order = await orderRepository.create({
      customerId: customer.id,
      productId,
      amount: price,
      idempotencyKey: `eaktele-${customer.id}-${productId}-${Date.now()}-${i}`,
      quantity: 1,
    });

    let stock;
    try {
      stock = await stockService.reserveForOrder(productId, order.id);
    } catch {
      break;
    }

    const deducted = await balanceService.deductForPurchase(customer.id, price, order.id);
    if (!deducted) {
      await stockService.releaseReserved(stock.id);
      break;
    }

    await orderRepository.markPaid(order.id, 0);
    await orderRepository.startFulfilling(order.id);
    await orderRepository.markDelivered(order.id);
    await stockService.confirmSold(stock.id);

    results.push({ orderId: order.id, stockId: stock.id });
    log.info({ orderId: order.id, stockId: stock.id, customerId: customer.id }, 'eaktele order completed');
  }

  if (results.length === 0) {
    await ctx.reply(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
    return;
  }

  for (const { orderId, stockId } of results) {
    const detail = await stockService.getDeliveryDetail(stockId);
    await ctx.reply(
      S.DELIVERY_SUCCESS(detail.phone, detail.password2fa, orderId),
      { parse_mode: 'Markdown', ...deliveryKeyboard(stockId) },
    );
  }

  if (results.length < qty) {
    await ctx.reply(
      `⚠️ Hanya ${results.length} dari ${qty} akun berhasil diproses (stok/saldo habis).`,
      { parse_mode: 'Markdown' },
    );
  }
}

// ── Legacy: pay from product detail (qty=1 langsung dari old flow) ────────────

export async function handlePayWithBalance(ctx: Context, productId: string): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const customer = await getOrCreateByTelegramId(String(ctx.from.id));
  const product = await getProduct(productId);
  const displayName = productDisplayLabel(product.name);

  if (customer.balance < product.price) {
    await ctx.editMessageText(
      S.ORDER_INSUFFICIENT(displayName, product.price, 1, customer.balance),
      { parse_mode: 'Markdown', ...insufficientBalanceKeyboard() },
    );
    return;
  }

  clearAll(ctx.from.id);
  await processBalanceOrder(ctx, productId, displayName, product.price, 1);
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export async function handleOrderCancel(ctx: Context): Promise<void> {
  if (ctx.from) clearAll(ctx.from.id);
  try { await (ctx as Context).answerCbQuery(); } catch { /* command context */ }
  try {
    await ctx.editMessageText(S.ORDER_CANCELLED, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply(S.ORDER_CANCELLED, { parse_mode: 'Markdown' });
  }
}
