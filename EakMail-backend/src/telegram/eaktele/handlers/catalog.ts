/**
 * Katalog EakTele — flat list semua produk dengan emoji bendera negara.
 * Flow: Beli Akun → pilih produk → konfirmasi (Buy/Instruction/Back/Home)
 */
import type { Context } from 'telegraf';
import { S } from '../i18n/strings.js';
import { mainMenuKeyboard, ACTION } from '../keyboards.js';
import { stockRepository } from '../../../modules/eaktele/stock.repository.js';
import { prisma } from '../../../db/client.js';

/** Phone code → emoji + nama negara. Sorted longest-first untuk matching. */
const COUNTRY_MAP: Record<string, { emoji: string; name: string }> = {
  '+880': { emoji: '🇧🇩', name: 'Bangladesh' },
  '+855': { emoji: '🇰🇭', name: 'Cambodia' },
  '+856': { emoji: '🇱🇦', name: 'Laos' },
  '+62':  { emoji: '🇮🇩', name: 'Indonesia' },
  '+60':  { emoji: '🇲🇾', name: 'Malaysia' },
  '+63':  { emoji: '🇵🇭', name: 'Philippines' },
  '+65':  { emoji: '🇸🇬', name: 'Singapore' },
  '+66':  { emoji: '🇹🇭', name: 'Thailand' },
  '+84':  { emoji: '🇻🇳', name: 'Vietnam' },
  '+90':  { emoji: '🇹🇷', name: 'Turkey' },
  '+91':  { emoji: '🇮🇳', name: 'India' },
  '+92':  { emoji: '🇵🇰', name: 'Pakistan' },
  '+95':  { emoji: '🇲🇲', name: 'Myanmar' },
  '+44':  { emoji: '🇬🇧', name: 'UK' },
  '+1':   { emoji: '🇺🇸', name: 'USA' },
};

const COUNTRY_CODES = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);

function extractPhoneCode(name: string): string | null {
  for (const code of COUNTRY_CODES) {
    if (name.includes(code)) return code;
  }
  return null;
}

/** Nama produk → label dengan emoji bendera.
 *  "Akun Tele +62"          → "🇮🇩 +62 Indonesia"
 *  "Akun Tele +62 User ID 7" → "🇮🇩 +62 Indonesia User ID 7"
 */
export function productDisplayLabel(name: string): string {
  const code = extractPhoneCode(name);
  if (!code) return name;
  const info = COUNTRY_MAP[code];
  if (!info) return name;

  // Hapus prefix generik, phone code, dan nama negara (jika sudah ada) → ambil sisa varian
  const extra = name
    .replace(/^akun\s+(tele(gram)?|tg)\s*/i, '')
    .replace(code, '')
    .replace(new RegExp(info.name, 'i'), '')
    .replace(/^\s*[-–—,]\s*/, '')
    .trim();

  return extra
    ? `${info.emoji} ${code} ${info.name} ${extra}`
    : `${info.emoji} ${code} ${info.name}`;
}

/** Tampil katalog flat — semua produk EakTele aktif sebagai inline buttons. */
export async function handleCatalog(ctx: Context): Promise<void> {
  const rawProducts = await prisma.product.findMany({
    where: { active: true, isEakTele: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, price: true },
  });

  if (rawProducts.length === 0) {
    await ctx.reply(S.CATALOG_EMPTY, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
    return;
  }

  const withStock = await Promise.all(
    rawProducts.map(async (p) => {
      const counts = await stockRepository.countByStatus(p.id);
      return { ...p, available: counts.AVAILABLE ?? 0 };
    }),
  );

  const available = withStock.filter((p) => p.available > 0);

  if (available.length === 0) {
    await ctx.reply(S.CATALOG_EMPTY, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
    return;
  }

  const totalStock = available.reduce((s, p) => s + p.available, 0);

  const productButtons = available.map((p) => [{
    text: `${productDisplayLabel(p.name)}  (${p.available})`,
    callback_data: `${ACTION.CATALOG_PRODUCT}:${p.id}`,
  }]);

  const { Markup } = await import('telegraf');
  await ctx.reply(
    S.CATALOG_TITLE(available.length, totalStock),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          ...productButtons,
          [Markup.button.callback(S.BTN_HOME, ACTION.BACK_MENU)],
        ],
      },
    },
  );
  void Markup;
}

/** User tap produk → tampil konfirmasi dengan tombol Buy/Instruction/Back/Home. */
export async function handleProductCallback(ctx: Context, productId: string): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCbQuery();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true },
  });
  if (!product) {
    await ctx.editMessageText(S.ERROR_GENERIC, { parse_mode: 'Markdown' });
    return;
  }

  const counts = await stockRepository.countByStatus(productId);
  const available = counts.AVAILABLE ?? 0;

  if (available === 0) {
    await ctx.editMessageText(S.ORDER_NO_STOCK, { parse_mode: 'Markdown' });
    return;
  }

  const displayName = productDisplayLabel(product.name);

  await ctx.editMessageText(
    S.PRODUCT_DETAIL(displayName, product.price, available),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: S.BTN_BUY, callback_data: `${ACTION.ORDER_START_BUY}:${productId}` }],
          [
            { text: S.BTN_INSTRUCTION_SHORT, callback_data: `${ACTION.INSTRUCTION}:catalog` },
            { text: S.BTN_BACK, callback_data: ACTION.BACK_TO_CATALOG },
          ],
          [{ text: S.BTN_HOME, callback_data: ACTION.BACK_MENU }],
        ],
      },
    },
  );
}
