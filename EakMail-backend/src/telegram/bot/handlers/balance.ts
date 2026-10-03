/**
 * /saldo and /topup handlers — customer balance check and top-up via Pakasir QRIS.
 *
 * /saldo  → show balance + quick-topup inline buttons (5k, 10k, 50k, 100k) + manual option
 * /topup <amount> → shortcut: directly create Pakasir QRIS for that amount
 * Callbacks: topup:amount:<n> → process preset amount directly
 *            topup:prompt     → ask user to type manual amount
 */
import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { resolveBotContext } from '../context.js';
import { MessageKey } from '../i18n/keys.js';
import { formatRupiah, formatExpiry } from '../format.js';
import { generateQrPng } from '../qr.js';
import { createTopup, cancelTopup, MIN_TOPUP, MAX_TOPUP } from '../../../modules/payments/topup.service.js';
import { logger } from '../../../lib/logger.js';
import { setAwaitingTopup, clearAwaitingTopup, setTopupMsg } from '../user-state.js';

const log = logger.child({ module: 'bot-balance' });

// Quick-amount preset buttons (label, callback data)
const PRESET_AMOUNTS: [string, number][] = [
  ['Rp 5.000', 5_000],
  ['Rp 10.000', 10_000],
  ['Rp 50.000', 50_000],
  ['Rp 100.000', 100_000],
];

export async function handleSaldo(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const balance = bot.customer.balance;
  const text = bot.tr(MessageKey.BALANCE_INFO, { balance: formatRupiah(balance) });

  const [p0, p1, p2, p3] = PRESET_AMOUNTS as [[string, number], [string, number], [string, number], [string, number]];
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      // Row 1: 5k, 10k
      [
        Markup.button.callback(p0[0], `topup:amount:${p0[1]}`),
        Markup.button.callback(p1[0], `topup:amount:${p1[1]}`),
      ],
      // Row 2: 50k, 100k
      [
        Markup.button.callback(p2[0], `topup:amount:${p2[1]}`),
        Markup.button.callback(p3[0], `topup:amount:${p3[1]}`),
      ],
      // Row 3: manual input
      [Markup.button.callback(bot.tr(MessageKey.BALANCE_TOPUP_MANUAL_BTN), 'topup:prompt')],
    ]),
  });
}

export async function handleTopup(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.trim().split(/\s+/);
  const rawAmount = parts[1];

  if (!rawAmount) {
    await handleSaldo(ctx);
    return;
  }

  await processTopup(ctx, bot, rawAmount);
}

/** Callback: topup:amount:<n> — preset amount button tapped */
export async function handleTopupAmountCallback(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;
  await ctx.answerCbQuery();

  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  const match = data.match(/^topup:amount:(\d+)$/);
  if (!match?.[1]) return;

  await processTopup(ctx, bot, match[1]);
}

/** Callback: topup:cancel:<topupId> — user cancels a pending QRIS topup */
export async function handleTopupCancelCallback(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;
  await ctx.answerCbQuery();

  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  const topupId = data.replace(/^topup:cancel:/, '');
  if (!topupId) return;

  const ok = await cancelTopup(topupId, bot.customer.id);
  if (ok) {
    await ctx.editMessageCaption(bot.tr(MessageKey.TOPUP_CANCELLED), { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(bot.tr(MessageKey.TOPUP_CANCEL_NOT_FOUND));
  }
  log.info({ topupId, customerId: bot.customer.id }, 'topup cancelled by user');
}

/** Callback: topup:prompt — "Other Amount" button tapped */
export async function handleTopupPromptCallback(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;
  await ctx.answerCbQuery();
  const telegramId = ctx.from?.id;
  if (telegramId) await setAwaitingTopup(telegramId);
  await ctx.reply(bot.tr(MessageKey.TOPUP_AMOUNT_PROMPT), { parse_mode: 'Markdown' });
}

/**
 * Called when user sends a plain text message and is in awaiting-topup state.
 * Returns true if handled (the text was processed as a topup amount), false to fall through.
 */
export async function handleTopupAmountMessage(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const { isAwaitingTopup } = await import('../user-state.js');
  if (!(await isAwaitingTopup(telegramId))) return false;

  const bot = await resolveBotContext(ctx);
  if (!bot) return false;

  // Always clear state first — even on invalid input (avoids getting stuck)
  await clearAwaitingTopup(telegramId);

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text.trim() : '';
  await processTopup(ctx, bot, text);
  return true;
}

async function processTopup(
  ctx: Context,
  bot: NonNullable<Awaited<ReturnType<typeof resolveBotContext>>>,
  rawAmount: string,
): Promise<void> {
  const amount = parseInt(rawAmount.replace(/[.,_\s]/g, ''), 10);

  if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    await ctx.reply(bot.tr(MessageKey.TOPUP_AMOUNT_INVALID), { parse_mode: 'Markdown' });
    return;
  }

  // Send a processing notice while we call Pakasir
  await ctx.reply(bot.tr(MessageKey.TOPUP_PROCESSING));

  try {
    const result = await createTopup(bot.customer.id, amount);

    const caption = bot.tr(MessageKey.TOPUP_QR_CAPTION, {
      amount: formatRupiah(amount),
      expiresAt: result.expiresAt ? formatExpiry(result.expiresAt) : '-',
    });
    const cancelKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback(bot.tr(MessageKey.TOPUP_CANCEL_BTN), `topup:cancel:${result.topupId}`)],
    ]);

    if (result.qrString) {
      const qrPng = await generateQrPng(result.qrString);
      const sent = await ctx.replyWithPhoto(
        { source: qrPng, filename: 'topup_qris.png' },
        { caption, parse_mode: 'Markdown', ...cancelKeyboard },
      );
      // Store message location so the settle flow can remove the button later.
      const chatId = sent.chat.id;
      const messageId = sent.message_id;
      if (chatId && messageId) {
        void setTopupMsg(result.topupId, chatId, messageId);
      }
    } else if (result.paymentUrl) {
      const sent = await ctx.reply(
        caption + `\n\n[Buka link pembayaran](${result.paymentUrl})`,
        { parse_mode: 'Markdown', ...cancelKeyboard },
      );
      const chatId = sent.chat.id;
      const messageId = sent.message_id;
      if (chatId && messageId) {
        void setTopupMsg(result.topupId, chatId, messageId);
      }
    }

    log.info({ customerId: bot.customer.id, amount, topupId: result.topupId }, 'topup initiated');
  } catch (err) {
    log.warn({ err }, 'topup creation failed');
    await ctx.reply('Gagal membuat permintaan topup. Coba lagi nanti.');
  }
}
