/**
 * Order flow EakTele — beli akun Telegram via saldo.
 * Alur: confirm → pay balance → reserve stok → mark SOLD → kirim detail akun.
 * QRIS bisa ditambahkan di Fase berikutnya; untuk sekarang cukup saldo.
 */
import type { Context } from 'telegraf';
import { S } from '../i18n/strings.js';
import { deliveryKeyboard } from '../keyboards.js';
import { getProduct } from '../../../modules/products/product.service.js';
import { orderService } from '../../../modules/orders/order.service.js';
import { balanceService } from '../../../modules/customers/balance.service.js';
import { stockService } from '../../../modules/eaktele/stock.service.js';
import { getOrCreateByTelegramId } from '../../bot/customer.repository.js';
import { logger } from '../../../lib/logger.js';
import { orderRepository } from '../../../modules/orders/order.repository.js';

const log = logger.child({ module: 'eaktele-order' });

/** Callback: user tap "Bayar dengan Saldo" — productId di callback data. */
export async function handlePayWithBalance(ctx: Context, productId: string): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const customer = await getOrCreateByTelegramId(String(ctx.from.id));
  const product = await getProduct(productId);

  // Cek saldo cukup
  if (customer.balance < product.price) {
    await ctx.editMessageText(
      S.ORDER_INSUFFICIENT(product.price, customer.balance),
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // Buat order
  let order;
  try {
    order = await orderService.createOrder({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('OUT_OF_STOCK')) {
      await ctx.editMessageText(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
      return;
    }
    throw err;
  }

  // Reserve stok akun (atomic)
  let stock;
  try {
    stock = await stockService.reserveForOrder(productId, order.id);
  } catch {
    await ctx.editMessageText(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
    return;
  }

  // Deduct saldo
  const deducted = await balanceService.deductForPurchase(customer.id, product.price, order.id);
  if (!deducted) {
    await stockService.releaseReserved(stock.id);
    await ctx.editMessageText(
      S.ORDER_INSUFFICIENT(product.price, customer.balance),
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // Mark order PAID → FULFILLING → DELIVERED + stok SOLD
  await orderRepository.markPaid(order.id, 0);
  await orderRepository.startFulfilling(order.id);
  await orderRepository.markDelivered(order.id);
  await stockService.confirmSold(stock.id);

  log.info({ orderId: order.id, stockId: stock.id, customerId: customer.id }, 'eaktele order completed');

  // Kirim detail akun ke pembeli
  const detail = await stockService.getDeliveryDetail(stock.id);
  await ctx.editMessageText(
    S.DELIVERY_SUCCESS(detail.phone, detail.password2fa, order.id),
    {
      parse_mode: 'Markdown',
      ...deliveryKeyboard(stock.id),
    },
  );
}

/** Callback: user tap "Batal". */
export async function handleOrderCancel(ctx: Context): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.editMessageText(S.ERROR_GENERIC, { parse_mode: 'Markdown' });
}
