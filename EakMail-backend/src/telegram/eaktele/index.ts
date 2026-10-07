/**
 * EakTele bot bootstrap — bot Telegram khusus jual-beli akun Telegram.
 *
 * Flow pembelian:
 * 1. Beli Akun → flat list produk (emoji bendera + stok)
 * 2. Tap produk → konfirmasi (Buy / Instruction / Back / Home)
 * 3. Tap Buy → ketik jumlah
 * 4. Kirim angka → cek saldo → proses order → kirim detail akun
 */
import https from 'https';
import { Telegraf, type Context } from 'telegraf';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { S } from './i18n/strings.js';
import { mainMenuKeyboard, ACTION } from './keyboards.js';
import { membershipGate, handleGateCheck, GATE_CHECK_ACTION } from './handlers/membership.js';
import { handleStart } from './handlers/start.js';
import { handleCatalog, handleProductCallback } from './handlers/catalog.js';
import {
  handleOrderStartBuy,
  handlePayWithBalance,
  handleConfirmPayBalance,
  handleConfirmPayQris,
  handleOrderCancel,
  handleQtyInput,
} from './handlers/order.js';
import { handleGetOtp, handleRefreshOtp } from './handlers/otp.js';
import { handleOrdersList, handleOrderDetail } from './handlers/orders-list.js';

const log = logger.child({ module: 'eaktele-bot' });

export interface EakTeleBot {
  bot: Telegraf;
  start(): Promise<void>;
  stop(reason?: string): Promise<void>;
  readonly isMock: boolean;
}

function registerHandlers(bot: Telegraf): void {
  // Gate: wajib join channel sebelum bisa pakai bot
  bot.use(membershipGate());
  bot.action(GATE_CHECK_ACTION, (ctx) => handleGateCheck(ctx, handleStart));

  // ── Commands ────────────────────────────────────────────────────────────
  bot.start(handleStart);
  bot.help(async (ctx) => ctx.reply(S.HELP, { parse_mode: 'Markdown', ...mainMenuKeyboard() }));
  bot.command('cancel', handleOrderCancel);

  // ── ReplyKeyboard text routing ──────────────────────────────────────────
  bot.hears(S.MENU_BUY, handleCatalog);
  bot.hears(S.MENU_ORDERS, handleOrdersList);
  bot.hears(S.MENU_BALANCE, async (ctx) => {
    if (!ctx.from) return;
    const { getOrCreateByTelegramId } = await import('../../telegram/bot/customer.repository.js');
    const customer = await getOrCreateByTelegramId(String(ctx.from.id));
    await ctx.reply(S.BALANCE_INFO(customer.balance), { parse_mode: 'Markdown' });
  });
  bot.hears(S.MENU_HELP, async (ctx) =>
    ctx.reply(S.HELP, { parse_mode: 'Markdown', ...mainMenuKeyboard() }),
  );

  // ── Catalog ─────────────────────────────────────────────────────────────
  // Tap produk di katalog flat: et:prod:<productId>
  bot.action(new RegExp(`^${ACTION.CATALOG_PRODUCT}:(.+)$`), async (ctx) => {
    const productId = ctx.match[1];
    if (productId) await handleProductCallback(ctx, productId);
  });

  // Back ke katalog dari product detail
  bot.action(ACTION.BACK_TO_CATALOG, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => undefined);
    await handleCatalog(ctx);
  });

  // ── Order ────────────────────────────────────────────────────────────────
  // Tap Buy di product detail → minta ketik jumlah
  bot.action(new RegExp(`^${ACTION.ORDER_START_BUY}:(.+)$`), async (ctx) => {
    const productId = ctx.match[1];
    if (productId) await handleOrderStartBuy(ctx, productId);
  });

  // Legacy: langsung bayar saldo 1 akun (dipakai dari halaman order detail)
  bot.action(new RegExp(`^${ACTION.ORDER_PAY_BALANCE}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    if (productId) await handlePayWithBalance(ctx, productId);
  });

  // Konfirmasi bayar saldo (dari payment selection screen)
  bot.action(ACTION.ORDER_PAY_BALANCE_CONFIRM, handleConfirmPayBalance);

  // Konfirmasi bayar QRIS (dari payment selection screen)
  bot.action(ACTION.ORDER_PAY_QRIS_CONFIRM, handleConfirmPayQris);

  // Cancel pembelian (inline button atau /cancel command)
  bot.action(ACTION.ORDER_CANCEL, handleOrderCancel);

  // Deposit button — tampilkan info deposit
  bot.action(ACTION.ORDER_DEPOSIT, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from) return;
    const { getOrCreateByTelegramId } = await import('../../telegram/bot/customer.repository.js');
    const customer = await getOrCreateByTelegramId(String(ctx.from.id));
    await ctx.reply(S.DEPOSIT_INFO(customer.balance), {
      parse_mode: 'Markdown',
      ...mainMenuKeyboard(),
    });
  });

  // ── OTP ──────────────────────────────────────────────────────────────────
  bot.action(new RegExp(`^${ACTION.GET_OTP}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleGetOtp(ctx, stockId);
  });

  bot.action(new RegExp(`^${ACTION.REFRESH_OTP}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleRefreshOtp(ctx, stockId);
  });

  // ── Instruksi ─────────────────────────────────────────────────────────────
  // et:instruction:<stockId|"catalog"> — jika dari katalog, tidak ada OTP button
  bot.action(new RegExp(`^${ACTION.INSTRUCTION}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const stockId = ctx.match[1] ?? '';
    const fromCatalog = stockId === 'catalog';
    const { Markup } = await import('telegraf');
    const keyboard = fromCatalog
      ? Markup.inlineKeyboard([[Markup.button.callback(S.BTN_HOME, ACTION.BACK_MENU)]])
      : (await import('./keyboards.js')).otpKeyboard(stockId);
    await ctx.reply(S.INSTRUCTION, { parse_mode: 'Markdown', ...keyboard });
  });

  // ── Logout guide ──────────────────────────────────────────────────────────
  bot.action(new RegExp(`^${ACTION.LOGOUT_GUIDE}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const stockId = ctx.match[1];
    const { logoutGuideKeyboard } = await import('./keyboards.js');
    await ctx.editMessageText(S.LOGOUT_GUIDE, {
      parse_mode: 'Markdown',
      ...logoutGuideKeyboard(stockId ?? ''),
    });
  });

  bot.action(new RegExp(`^${ACTION.CONFIRM_LOGOUT}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const stockId = ctx.match[1];
    if (stockId) {
      const { stockService } = await import('../../modules/eaktele/stock.service.js');
      await stockService.markBuyerLoggedOut(stockId);
    }
    try { await ctx.deleteMessage(); } catch { /* ignore */ }
    await ctx.reply(S.LOGOUT_CONFIRMED, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  });

  // ── Pesanan ───────────────────────────────────────────────────────────────
  bot.action(new RegExp(`^${ACTION.ORDER_DETAIL}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleOrderDetail(ctx, stockId);
  });

  // ── Navigation ────────────────────────────────────────────────────────────
  bot.action(ACTION.BACK_MENU, async (ctx) => {
    await ctx.answerCbQuery();
    await handleStart(ctx);
  });

  // ── Text fallback — cek apakah user sedang ketik jumlah ──────────────────
  bot.on('text', async (ctx) => {
    const handled = await handleQtyInput(ctx);
    if (!handled) {
      await ctx.reply(S.ERROR_UNKNOWN_COMMAND, { ...mainMenuKeyboard() });
    }
  });

  // ── Error boundary ────────────────────────────────────────────────────────
  bot.catch(async (err, ctx: Context) => {
    const msg = err instanceof Error ? err.message : String(err);

    // Telegram API errors yang tidak perlu ditampilkan ke user
    const isExpectedTgError =
      msg.includes('message is not modified') ||
      msg.includes('message to edit not found') ||
      msg.includes('query is too old') ||
      msg.includes('MESSAGE_ID_INVALID') ||
      msg.includes('BUTTON_DATA_INVALID') ||
      msg.includes('bot was blocked by the user');

    if (isExpectedTgError) {
      log.warn({ err }, 'eaktele: expected telegram API error — suppressed');
      return;
    }

    log.error({ err }, 'eaktele handler error');
    try {
      await ctx.reply(S.ERROR_GENERIC, { ...mainMenuKeyboard() });
    } catch { /* ignore */ }
  });
}

export async function buildEakTeleBot(): Promise<EakTeleBot> {
  const token = config.EAKTELE_BOT_TOKEN;
  const isMock = config.USE_MOCKS || !token;

  const ipv4Agent = new https.Agent({ family: 4 });
  const bot = new Telegraf(token || 'mock-eaktele-token', { telegram: { agent: ipv4Agent } });
  registerHandlers(bot);

  if (isMock) {
    log.info({ hasToken: Boolean(token) }, 'EakTele bot built (mock; not launched live)');
  }

  return {
    bot,
    isMock,
    async start() {
      if (isMock) {
        log.info('EakTele bot start() skipped (mock mode)');
        return;
      }
      bot.launch().catch((err) => {
        log.error({ err }, 'EakTele bot launch error — bot offline, server continues');
      });
      log.info('EakTele bot launched (long polling)');

      bot.telegram.setMyCommands([
        { command: 'start', description: 'Menu utama EakTele' },
        { command: 'cancel', description: 'Batal pembelian' },
        { command: 'help', description: 'Bantuan' },
      ]).catch((err) => {
        log.warn({ err }, 'EakTele setMyCommands failed');
      });
    },
    async stop(reason?: string) {
      if (!isMock) bot.stop(reason);
      log.info({ reason }, 'EakTele bot stopped');
    },
  };
}
