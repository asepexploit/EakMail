/**
 * EakTele bot bootstrap — bot Telegram khusus jual-beli akun Telegram.
 * Berjalan paralel dengan storefront bot EakMail; token terpisah, kode terpisah.
 *
 * Menu utama pakai ReplyKeyboard (tombol besar permanen).
 * Sub-menu, konfirmasi, dan OTP pakai InlineKeyboard.
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
import { handlePayWithBalance, handleOrderCancel } from './handlers/order.js';
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

  // Gate re-check callback — bypass gate sehingga bisa proses ulang
  bot.action(GATE_CHECK_ACTION, (ctx) => handleGateCheck(ctx, handleStart));

  // Commands
  bot.start(handleStart);
  bot.help(async (ctx) => ctx.reply(S.HELP, { parse_mode: 'Markdown', ...mainMenuKeyboard() }));

  // ReplyKeyboard text routing
  bot.hears(S.MENU_BUY, handleCatalog);
  bot.hears(S.MENU_ORDERS, handleOrdersList);
  bot.hears(S.MENU_BALANCE, async (ctx) => {
    if (!ctx.from) return;
    const { getOrCreateByTelegramId } = await import('./handlers/start.js').then(() =>
      import('../bot/customer.repository.js'),
    );
    const customer = await getOrCreateByTelegramId(String(ctx.from.id));
    await ctx.reply(S.BALANCE_INFO(customer.balance), { parse_mode: 'Markdown' });
  });
  bot.hears(S.MENU_HELP, async (ctx) =>
    ctx.reply(S.HELP, { parse_mode: 'Markdown', ...mainMenuKeyboard() }),
  );

  // Catalog product select: et:prod:<productId>
  bot.action(new RegExp(`^${ACTION.CATALOG_PRODUCT}:(.+)$`), async (ctx) => {
    const productId = ctx.match[1];
    if (productId) await handleProductCallback(ctx, productId);
  });

  // Pay with balance: et:pay:balance:<productId>
  bot.action(new RegExp(`^${ACTION.ORDER_PAY_BALANCE}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    if (productId) await handlePayWithBalance(ctx, productId);
  });

  // Cancel order
  bot.action(ACTION.ORDER_CANCEL, handleOrderCancel);

  // Get OTP: et:otp:<stockId>
  bot.action(new RegExp(`^${ACTION.GET_OTP}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleGetOtp(ctx, stockId);
  });

  // Refresh OTP: et:otp:refresh:<stockId>
  bot.action(new RegExp(`^${ACTION.REFRESH_OTP}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleRefreshOtp(ctx, stockId);
  });

  // Logout guide: et:logout:guide:<stockId>
  bot.action(new RegExp(`^${ACTION.LOGOUT_GUIDE}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const stockId = ctx.match[1];
    const { logoutGuideKeyboard } = await import('./keyboards.js');
    await ctx.editMessageText(S.LOGOUT_GUIDE, {
      parse_mode: 'Markdown',
      ...logoutGuideKeyboard(stockId ?? ''),
    });
  });

  // Buyer confirm logout: et:logout:confirm:<stockId>
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

  // Order detail: et:order:<stockId>
  bot.action(new RegExp(`^${ACTION.ORDER_DETAIL}:(.+)$`), async (ctx) => {
    const stockId = ctx.match[1];
    if (stockId) await handleOrderDetail(ctx, stockId);
  });

  // Back to menu
  bot.action(ACTION.BACK_MENU, async (ctx) => {
    await ctx.answerCbQuery();
    await handleStart(ctx);
  });

  // Fallback text
  bot.on('text', async (ctx) => {
    await ctx.reply(S.ERROR_UNKNOWN_COMMAND, { ...mainMenuKeyboard() });
  });

  // Error boundary
  bot.catch(async (err, ctx: Context) => {
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
