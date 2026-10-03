/**
 * /catalog handler — interactive inline-keyboard catalog (Phase 3a).
 *
 * Navigation flow:
 *   Level 1: all active products (one button per product, with price + stock).
 *   Level 2a: if the product has options → option selector (each option has its own price).
 *   Level 2b: if no options → quantity selector (1–5).
 *   Level 3 (after option selected): quantity selector.
 *
 * callback_data conventions (see keyboards.ts):
 *   prod:<productId>          → show level 2 for that product
 *   opt:<productId>:<optId>   → option chosen, show qty
 *   qty:<productId>:<n>[:<optId>]  → qty chosen, run order flow
 *   cat:back                  → return to level 1
 */
import { Markup, type Context } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';
import { StockMode, type ProductDto, type ProductOptionDto } from '@eakmail/shared-types';
import { listProducts } from '../../../modules/products/product.service.js';
import { MessageKey } from '../i18n/keys.js';
import type { Translator } from '../i18n/index.js';
import { resolveBotContext } from '../context.js';
import { formatRupiah } from '../format.js';
import {
  CAT_ACTION_PREFIX,
  PROD_ACTION_PREFIX,
  QTY_ACTION_PREFIX,
  OPT_ACTION_PREFIX,
  OUT_ACTION_PREFIX,
  MANUAL_QTY_ACTION_PREFIX,
} from '../keyboards.js';
import { setAwaitingQty, clearAwaitingQty, getAwaitingQty } from '../user-state.js';

let cachedProducts: ProductDto[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000;

async function getActiveProducts(): Promise<ProductDto[]> {
  if (cachedProducts && Date.now() < cacheExpiry) return cachedProducts;
  const products = (await listProducts()).filter((p) => p.active);
  cachedProducts = products;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return products;
}

/** Force-expire the catalog cache (e.g. after stock changes). */
export function invalidateCatalogCache(): void {
  cachedProducts = null;
  cacheExpiry = 0;
}

// ---- keyboard builders -------------------------------------------------------

/**
 * Stock display rule:
 * - UNLIMITED → no label, never blocked.
 * - stock > 0 (any mode) → show count, tappable.
 * - stock === 0 + MANUAL → "Habis", non-tappable (admin explicitly manages stock).
 * - stock === 0 + other modes → "Habis", non-tappable (admin set stock counter to 0 = depleted).
 *
 * Exception: stock === 0 AND mode is not MANUAL AND mode is WORKFLOW/API_SUPPLIER →
 * treat as "not configured" (tappable, no label) so new products aren't blocked by default.
 * Admin must set stock > 0 to activate the counter, then it counts down to 0 and blocks.
 */
function stockInfo(p: ProductDto): { label: string; isOut: boolean } {
  if (p.stockMode === StockMode.UNLIMITED) return { label: '', isOut: false };
  if (p.stock > 0) return { label: ` (${p.stock})`, isOut: false };
  // MANUAL always blocks at 0 — admin controls stock directly.
  if (p.stockMode === StockMode.MANUAL) return { label: ' — Habis', isOut: true };
  // Non-MANUAL at 0: only block if this product has ever had stock > 0.
  // We can't know this from the DTO alone, so treat 0 as "counter depleted → block".
  // Admin should set stock > 0 on the product to enable tracking; 0 means depleted.
  return { label: ' — Habis', isOut: true };
}

function productListKeyboard(products: ProductDto[], tr: Translator): Markup.Markup<InlineKeyboardMarkup> {
  const rows = products.map((p) => {
    const { label: stockLabel, isOut } = stockInfo(p);
    const label = `${p.name} — Rp ${formatRupiah(p.price)}${stockLabel}`;

    if (isOut) {
      // callback_data is capped at 64 bytes by Telegram — just send the product ID.
      // The handler looks up the name from the in-process cache.
      return [Markup.button.callback(label, `${OUT_ACTION_PREFIX}:${p.id}`)];
    }
    return [Markup.button.callback(label, `${PROD_ACTION_PREFIX}:${p.id}`)];
  });
  return Markup.inlineKeyboard(rows);
}

function optionKeyboard(
  product: ProductDto,
  tr: Translator,
): Markup.Markup<InlineKeyboardMarkup> {
  const rows = product.options.map((opt) => {
    const displayPrice = opt.price > 0 ? opt.price : product.price;
    return [
      Markup.button.callback(
        `${opt.value} — Rp${formatRupiah(displayPrice)}`,
        `${OPT_ACTION_PREFIX}:${product.id}:${opt.id}`,
      ),
    ];
  });
  rows.push([Markup.button.callback(tr(MessageKey.CATALOG_BACK), `${CAT_ACTION_PREFIX}:back`)]);
  return Markup.inlineKeyboard(rows);
}

const MAX_QTY = 5;

function quantityKeyboard(
  product: ProductDto,
  tr: Translator,
  optionId?: string,
): Markup.Markup<InlineKeyboardMarkup> {
  const isManual = product.stockMode === StockMode.MANUAL;
  const maxAvailable = isManual ? Math.min(product.stock, MAX_QTY) : MAX_QTY;

  const qtyButtons = [];
  for (let i = 1; i <= maxAvailable; i++) {
    const data = optionId
      ? `${QTY_ACTION_PREFIX}:${product.id}:${i}:${optionId}`
      : `${QTY_ACTION_PREFIX}:${product.id}:${i}`;
    qtyButtons.push(Markup.button.callback(`${i}`, data));
  }

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (qtyButtons.length > 0) {
    rows.push(qtyButtons);
  } else {
    rows.push([Markup.button.callback(tr(MessageKey.CATALOG_OUT_OF_STOCK), 'noop')]);
  }

  // Manual-input button (always shown so user can type arbitrary qty)
  const manualData = optionId
    ? `${MANUAL_QTY_ACTION_PREFIX}:${product.id}:${optionId}`
    : `${MANUAL_QTY_ACTION_PREFIX}:${product.id}`;
  rows.push([Markup.button.callback(tr(MessageKey.CATALOG_QTY_MANUAL_BTN), manualData)]);

  // Back goes to option selector (if product has options) or product list.
  const backData = product.options.length > 0
    ? `${PROD_ACTION_PREFIX}:${product.id}`
    : `${CAT_ACTION_PREFIX}:back`;
  rows.push([Markup.button.callback(tr(MessageKey.CATALOG_BACK), backData)]);

  return Markup.inlineKeyboard(rows);
}

// ---- helpers -----------------------------------------------------------------

async function sendOrEdit(
  ctx: Context,
  text: string,
  keyboard?: Markup.Markup<InlineKeyboardMarkup>,
  imageUrl?: string | null,
): Promise<void> {
  // When navigating via callback (inline tap), we can only edit text — not swap photo.
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, keyboard);
      return;
    } catch { /* fall through to reply */ }
  }
  // Fresh message: send photo if available, otherwise text.
  if (imageUrl) {
    try {
      await ctx.replyWithPhoto(imageUrl, {
        caption: text,
        parse_mode: 'Markdown',
        ...(keyboard ?? {}),
      });
      return;
    } catch { /* bad URL — fall through */ }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...(keyboard ?? {}) });
}

// ---- handlers ----------------------------------------------------------------

/** Entry point: /catalog command or menu:catalog callback. */
export async function handleCatalog(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const products = await getActiveProducts();
  if (products.length === 0) {
    await sendOrEdit(ctx, bot.tr(MessageKey.CATALOG_EMPTY));
    return;
  }

  await sendOrEdit(ctx, bot.tr(MessageKey.CATALOG_SELECT_CATEGORY), productListKeyboard(products, bot.tr), null);
}

/** Handle cat:back — return to product list. */
export async function handleCategoryCallback(ctx: Context, action: string): Promise<void> {
  if (action !== 'back') return;
  await handleCatalog(ctx);
}

/**
 * Handle prod:<id> — show option selector if product has options, else qty selector.
 */
export async function handleProductCallback(ctx: Context, productId: string): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const products = await getActiveProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const isManual = product.stockMode === StockMode.MANUAL;
  const stockLine = isManual ? `\n📦 Stok: ${product.stock}` : '';
  const descLine = product.description ? `\n\n${product.description}` : '';

  if (product.options.length > 0) {
    // Show option selector — let the user pick a variant first.
    const text = bot.tr(MessageKey.CATALOG_PRODUCT_DETAIL, {
      name: product.name,
      price: formatRupiah(product.price),
      description: bot.tr(MessageKey.CATALOG_SELECT_OPTION),
    }) + stockLine;
    await sendOrEdit(ctx, text, optionKeyboard(product, bot.tr), product.imageUrl);
  } else {
    // No options — go straight to qty selector.
    const text = bot.tr(MessageKey.CATALOG_SELECT_QTY, {
      name: product.name,
      price: formatRupiah(product.price),
    }) + stockLine + descLine;
    await sendOrEdit(ctx, text, quantityKeyboard(product, bot.tr), product.imageUrl);
  }
}

/**
 * Handle opt:<productId>:<optionId> — option chosen, show qty selector.
 */
export async function handleOptionCallback(
  ctx: Context,
  productId: string,
  optionId: string,
): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const products = await getActiveProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const option = product.options.find((o) => o.id === optionId);
  if (!option) return;

  const isManual = product.stockMode === StockMode.MANUAL;
  const stockLine = isManual ? `\n📦 Stok: ${product.stock}` : '';
  const displayPrice = option.price > 0 ? option.price : product.price;

  const text = bot.tr(MessageKey.CATALOG_SELECT_QTY, {
    name: `${product.name} — ${option.value}`,
    price: formatRupiah(displayPrice),
  }) + stockLine;

  await sendOrEdit(ctx, text, quantityKeyboard(product, bot.tr, optionId), product.imageUrl);
}

/**
 * Handle out:<productId> — show "out of stock" popup (answerCbQuery alert).
 * Looks up the name from the in-process product cache so callback_data stays short.
 */
export async function handleOutOfStockCallback(ctx: Context, productId: string): Promise<void> {
  const products = await getActiveProducts();
  const product = products.find((p) => p.id === productId);
  const name = product?.name ?? 'Produk ini';
  await ctx.answerCbQuery(
    `📦 Stok Habis\n\n${name} sedang tidak tersedia.\nSilakan pilih produk lain atau coba lagi nanti.`,
    { show_alert: true },
  );
}

/**
 * Handle qtymanual:<productId>[:<optionId>] — set awaiting-qty Redis state and prompt.
 */
export async function handleManualQtyCallback(
  ctx: Context,
  productId: string,
  optionId?: string,
): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;
  await ctx.answerCbQuery();
  const telegramId = ctx.from?.id;
  if (telegramId) await setAwaitingQty(telegramId, productId, optionId);
  await ctx.reply(bot.tr(MessageKey.CATALOG_QTY_PROMPT));
}

/**
 * Called when a user sends a plain text message and is in awaiting-qty state.
 * Returns true if handled; false to fall through to the next text handler.
 */
export async function handleQtyMessage(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const state = await getAwaitingQty(telegramId);
  if (!state) return false;

  const bot = await resolveBotContext(ctx);
  if (!bot) return false;

  await clearAwaitingQty(telegramId);

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text.trim() : '';
  const quantity = parseInt(text.replace(/[.,_\s]/g, ''), 10);

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99) {
    await ctx.reply(bot.tr(MessageKey.CATALOG_QTY_INVALID));
    return true;
  }

  const { runOrderFlow } = await import('./order.js');
  await runOrderFlow(ctx, bot, state.productId, quantity, state.optionId);
  return true;
}
