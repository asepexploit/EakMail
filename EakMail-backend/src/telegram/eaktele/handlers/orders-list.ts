/** Pesanan Saya — daftar akun yang sudah dibeli pelanggan. */
import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { S } from '../i18n/strings.js';
import { mainMenuKeyboard, deliveryKeyboard, ACTION } from '../keyboards.js';
import { getOrCreateByTelegramId } from '../../bot/customer.repository.js';
import type { TelegramAccountStock } from '@prisma/client';
import { stockService } from '../../../modules/eaktele/stock.service.js';
import { prisma } from '../../../db/client.js';

export async function handleOrdersList(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const customer = await getOrCreateByTelegramId(String(ctx.from.id));

  // Ambil order milik customer ini, lalu filter stok SOLD yang terhubung
  const customerOrders = await prisma.order.findMany({
    where: { customerId: customer.id, status: 'DELIVERED' },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const orderIds = customerOrders.map((o) => o.id);
  if (orderIds.length === 0) {
    await ctx.reply(S.ORDERS_EMPTY, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
    return;
  }

  const sold = await prisma.telegramAccountStock.findMany({
    where: { status: 'SOLD', orderId: { in: orderIds } },
    orderBy: { soldAt: 'desc' },
  });

  if (sold.length === 0) {
    await ctx.reply(S.ORDERS_EMPTY, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
    return;
  }

  const orderDateMap = new Map(customerOrders.map((o) => [o.id, o.createdAt]));

  const lines = sold.map((s: TelegramAccountStock, i: number) => {
    const orderDate = s.orderId ? orderDateMap.get(s.orderId) : null;
    const date = orderDate
      ? orderDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';
    return S.ORDER_ITEM(i + 1, s.phone, date);
  });

  const buttons = sold.map((s: TelegramAccountStock, i: number) => [
    Markup.button.callback(S.BTN_ORDER_DETAIL(i + 1), `${ACTION.ORDER_DETAIL}:${s.id}`),
  ]);

  await ctx.reply(
    `${S.ORDERS_TITLE}${lines.join('\n\n')}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([...buttons, [Markup.button.callback(S.BTN_BACK_MENU, ACTION.BACK_MENU)]]),
    },
  );
}

/** Tampil detail satu order dari list. */
export async function handleOrderDetail(ctx: Context, stockId: string): Promise<void> {
  await ctx.answerCbQuery();

  const detail = await stockService.getDeliveryDetail(stockId);
  const stock = await stockService.get(stockId);

  await ctx.editMessageText(
    S.DELIVERY_SUCCESS(detail.phone, detail.password2fa, stock.orderId ?? '-'),
    {
      parse_mode: 'Markdown',
      ...deliveryKeyboard(stockId),
    },
  );
}
