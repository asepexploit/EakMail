/**
 * Storefront bot bootstrap (Telegraf) — F7/F16/F17, TASKS Phase 3a.
 *
 * buildBot() wires the command handlers and the menu/language callback routes, resolves
 * the bot token from bot_config (decrypted) or config.STOREFRONT_BOT_TOKEN, and registers
 * the outbound send API used by the notifications worker + DELIVER node. It does NOT
 * launch a live connection when config.USE_MOCKS is true (task rule) — the instance is
 * still returned so handlers can be exercised in tests/mocks.
 *
 * The bot is stateless; all per-customer state lives in the DB. Copy is never hardcoded —
 * every reply routes through the i18n resolver with bot_config overrides.
 */
import { Telegraf, type Context } from 'telegraf';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { handleStart } from './handlers/start.js';
import {
  handleCatalog,
  handleCategoryCallback,
  handleProductCallback,
  handleOptionCallback,
} from './handlers/catalog.js';
import { handleOrder, runOrderFlow, handlePayCallback } from './handlers/order.js';
import { handleStatus } from './handlers/status.js';
import {
  handleLanguage,
  applyLanguageSelection,
  isSupportedLanguage,
} from './handlers/language.js';
import { handleSaldo, handleTopup, handleTopupAmountCallback, handleTopupPromptCallback, handleTopupCancelCallback, handleTopupAmountMessage } from './handlers/balance.js';
import { MessageKey } from './i18n/keys.js';
import { resolveBotContext } from './context.js';
import {
  MENU_ACTION_PREFIX,
  LANG_ACTION_PREFIX,
  CAT_ACTION_PREFIX,
  PROD_ACTION_PREFIX,
  QTY_ACTION_PREFIX,
  PAY_ACTION_PREFIX,
  OPT_ACTION_PREFIX,
} from './keyboards.js';
import { registerSendApi } from './sender.js';
import { resolveBotToken } from './runtime-config.js';

const log = logger.child({ module: 'storefront-bot' });

/** Handle to the running (or mock) bot plus lifecycle helpers. */
export interface StorefrontBot {
  bot: Telegraf;
  /** Launch the live long-polling connection (no-op when mocking). */
  start(): Promise<void>;
  /** Stop the bot and unregister the send API. */
  stop(reason?: string): Promise<void>;
  /** True when built in mock mode (never connected live). */
  readonly isMock: boolean;
}

/** Map a "menu:<action>" callback to the matching handler. */
async function routeMenuAction(ctx: Context, action: string): Promise<void> {
  switch (action) {
    case 'catalog':
      await handleCatalog(ctx);
      return;
    case 'status':
      await handleStatus(ctx);
      return;
    case 'language':
      await handleLanguage(ctx);
      return;
    case 'saldo':
      await handleSaldo(ctx);
      return;
    case 'topup':
      await handleTopup(ctx);
      return;
    default:
      // Custom action shaped as "order:<productId>" from a configured catalog button.
      if (action.startsWith('order:')) {
        const productId = action.slice('order:'.length);
        const bot = await resolveBotContext(ctx);
        if (bot && productId) await runOrderFlow(ctx, bot, productId, 1);
        return;
      }
      log.warn({ action }, 'unknown menu action');
  }
}

/** Register all command + callback handlers on a Telegraf instance. */
function registerHandlers(bot: Telegraf): void {
  bot.start(handleStart);
  bot.command('catalog', handleCatalog);
  bot.command('order', handleOrder);
  bot.command('status', handleStatus);
  bot.command('saldo', handleSaldo);
  bot.command('topup', handleTopup);
  bot.command('language', handleLanguage);

  // Inline menu buttons: "menu:<action>".
  bot.action(new RegExp(`^${MENU_ACTION_PREFIX}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];
    if (action) await routeMenuAction(ctx, action);
  });

  // Catalog category drill-down: "cat:<supplierId>" or "cat:back".
  bot.action(new RegExp(`^${CAT_ACTION_PREFIX}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = ctx.match[1];
    if (categoryId) await handleCategoryCallback(ctx, categoryId);
  });

  // Product detail from catalog: "prod:<productId>".
  bot.action(new RegExp(`^${PROD_ACTION_PREFIX}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    if (productId) await handleProductCallback(ctx, productId);
  });

  // Option selection from product detail: "opt:<productId>:<optionId>".
  bot.action(new RegExp(`^${OPT_ACTION_PREFIX}:([^:]+):(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    const optionId = ctx.match[2];
    if (productId && optionId) await handleOptionCallback(ctx, productId, optionId);
  });

  // Quantity selection from catalog: "qty:<productId>:<amount>" or "qty:<productId>:<amount>:<optionId>".
  bot.action(new RegExp(`^${QTY_ACTION_PREFIX}:([^:]+):(\\d+)(?::(.+))?$`), async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    const quantity = parseInt(ctx.match[2] ?? '1', 10);
    const optionId = ctx.match[3]; // undefined when no option
    if (productId && quantity > 0) {
      const bot = await resolveBotContext(ctx);
      if (bot) await runOrderFlow(ctx, bot, productId, quantity, optionId);
    }
  });

  // Payment method selection: "pay:balance:<orderId>" or "pay:qris:<orderId>".
  bot.action(new RegExp(`^${PAY_ACTION_PREFIX}:[^:]+:.+$`), handlePayCallback);

  // Balance top-up preset amount buttons: "topup:amount:<n>".
  bot.action(/^topup:amount:(\d+)$/, handleTopupAmountCallback);

  // Cancel a pending topup: "topup:cancel:<topupId>".
  bot.action(/^topup:cancel:.+$/, handleTopupCancelCallback);

  // Balance top-up manual prompt button.
  bot.action('topup:prompt', handleTopupPromptCallback);

  // No-op button (e.g. out-of-stock indicator) — just acknowledge the tap.
  bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery();
  });

  // Language selection: "lang:<code>".
  bot.action(new RegExp(`^${LANG_ACTION_PREFIX}:(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1] ?? '';
    if (isSupportedLanguage(code)) await applyLanguageSelection(ctx, code);
  });

  // Any other text: check if user is awaiting topup input first, then fallback.
  bot.on('text', async (ctx) => {
    const handled = await handleTopupAmountMessage(ctx);
    if (handled) return;

    const resolved = await resolveBotContext(ctx);
    if (!resolved) return;
    await ctx.reply(resolved.tr(MessageKey.ERROR_UNKNOWN_COMMAND));
  });

  // Centralized error boundary: log and reply with a generic localized message.
  bot.catch(async (err, ctx) => {
    log.error({ err }, 'storefront bot handler error');
    try {
      const resolved = await resolveBotContext(ctx);
      if (resolved) await ctx.reply(resolved.tr(MessageKey.ERROR_GENERIC));
    } catch (replyErr) {
      log.error({ err: replyErr }, 'failed to send error reply');
    }
  });
}

/**
 * Build the storefront bot. When USE_MOCKS is true (or no token is configured), the bot
 * is constructed but never launched live; the send API falls back to logging (sender.ts).
 */
export async function buildBot(): Promise<StorefrontBot> {
  const token = await resolveBotToken();
  const isMock = config.USE_MOCKS || !token;

  // Telegraf requires a non-empty token to construct; use a placeholder when mocking so
  // the instance exists for wiring/tests without ever connecting.
  const bot = new Telegraf(token ?? 'mock-token');
  registerHandlers(bot);

  if (isMock) {
    log.info({ mock: config.USE_MOCKS, hasToken: Boolean(token) }, 'storefront bot built (mock; not launched live)');
    // Do not register a live send API — sender.ts logs instead of dispatching.
  } else {
    registerSendApi(bot.telegram);
  }

  return {
    bot,
    isMock,
    async start() {
      if (isMock) {
        log.info('storefront bot start() skipped (mock mode)');
        return;
      }
      // launch() resolves only after the bot stops; run it detached.
      void bot.launch();
      log.info('storefront bot launched (long polling)');
    },
    async stop(reason?: string) {
      registerSendApi(null);
      if (!isMock) bot.stop(reason);
      log.info({ reason }, 'storefront bot stopped');
    },
  };
}
