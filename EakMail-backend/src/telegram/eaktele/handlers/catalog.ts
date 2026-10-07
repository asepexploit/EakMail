/** Katalog paket akun EakTele — pilih produk, lihat stok. */
import type { Context } from 'telegraf';
import { S } from '../i18n/strings.js';
import { mainMenuKeyboard, catalogProductKeyboard, ACTION } from '../keyboards.js';
import { getProduct } from '../../../modules/products/product.service.js';
import { stockRepository } from '../../../modules/eaktele/stock.repository.js';
import { prisma } from '../../../db/client.js';

export async function handleCatalog(ctx: Context): Promise<void> {
  // Hanya produk aktif yang isEakTele=true (produk khusus jual akun Telegram)
  const rawProducts = await prisma.product.findMany({
    where: { active: true, isEakTele: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, price: true },
  });
  const aktif = rawProducts;

  if (aktif.length === 0) {
    await ctx.reply(S.CATALOG_EMPTY, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
    return;
  }

  for (const product of aktif) {
    const counts = await stockRepository.countByStatus(product.id);
    const available = counts.AVAILABLE ?? 0;
    const text = available > 0
      ? S.CATALOG_ITEM(product.name, product.price, available)
      : S.CATALOG_SOLD_OUT(product.name);

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...catalogProductKeyboard(product.id, product.name, product.price, available > 0),
    });
  }
}

/** Callback: user tap tombol "Beli 1 Akun" → tampil konfirmasi order. */
export async function handleProductCallback(ctx: Context, productId: string): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const product = await getProduct(productId);
  const counts = await stockRepository.countByStatus(productId);

  if (counts.AVAILABLE === 0) {
    await ctx.editMessageText(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
    return;
  }

  const { getOrCreateByTelegramId } = await import('../../bot/customer.repository.js');
  const customer = await getOrCreateByTelegramId(String(ctx.from.id));
  const balance = customer.balance ?? 0;

  // Import keyboard lazily to avoid circular
  const { orderConfirmKeyboard } = await import('../keyboards.js');

  // Buat pending order ID sementara (orderId di-generate saat bayar)
  // Simpan productId di callback data
  const { Markup } = await import('telegraf');
  await ctx.editMessageText(
    S.ORDER_CONFIRM(product.name, product.price, balance),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: S.BTN_PAY_BALANCE, callback_data: `${ACTION.ORDER_PAY_BALANCE}:${productId}` }],
          [{ text: S.BTN_CANCEL, callback_data: ACTION.ORDER_CANCEL }],
        ],
      },
    },
  );
  void Markup; // suppress unused import warning
}
