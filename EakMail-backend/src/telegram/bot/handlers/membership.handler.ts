/**
 * Force-join channel gate (storefront bot).
 *
 * membershipGate() is a Telegraf middleware that runs before every handler.
 * If the user hasn't joined all channels in REQUIRED_JOIN_CHANNELS it blocks
 * the interaction and sends the gate message with join + re-check buttons.
 *
 * The "✅ Sudah Bergabung" callback is exported separately so index.ts can
 * wire it after the gate middleware (the callback itself bypasses the gate so
 * we can re-check and proceed to the start flow on success).
 *
 * REQUIRED_JOIN_CHANNELS = comma-separated usernames, e.g. "@eakmails,@ch2"
 * Empty / unset → gate is disabled entirely.
 */
import { Markup } from 'telegraf';
import type { Context, MiddlewareFn } from 'telegraf';
import { config } from '../../../config/index.js';
import { logger } from '../../../lib/logger.js';

const log = logger.child({ module: 'membership-gate' });

export const MEMBERSHIP_CHECK_ACTION = 'membership:check';

/** Parse REQUIRED_JOIN_CHANNELS into a list of @-prefixed usernames. */
export function getRequiredChannels(): string[] {
  return config.REQUIRED_JOIN_CHANNELS
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c.startsWith('@') ? c : `@${c}`));
}

/** True when userId has joined channelUsername. Falls back to true on API error (don't block). */
async function checkMembership(ctx: Context, channelUsername: string): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(channelUsername, ctx.from!.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch {
    return true;
  }
}

/** Check all required channels; returns usernames the user hasn't joined yet. */
async function findUnjoined(ctx: Context, channels: string[]): Promise<string[]> {
  const results = await Promise.all(
    channels.map(async (ch) => ({ ch, joined: await checkMembership(ctx, ch) })),
  );
  return results.filter((r) => !r.joined).map((r) => r.ch);
}

/** Send the "Akses Terbatas" gate message (edit-in-place or fresh reply). */
async function sendGateMessage(ctx: Context, unjoined: string[]): Promise<void> {
  const channelList = unjoined.map((c) => `• ${c}`).join('\n');
  const text =
    `🔒 *Akses Terbatas*\n\n` +
    `Untuk menggunakan bot ini, kamu wajib bergabung ke:\n\n` +
    `${channelList}\n\n` +
    `Setelah bergabung, tekan tombol di bawah.`;

  const joinButtons = unjoined.map((ch) =>
    [Markup.button.url(`🔗 Gabung ${ch}`, `https://t.me/${ch.replace('@', '')}`)],
  );
  const checkButton = [Markup.button.callback('✅ Sudah Bergabung', MEMBERSHIP_CHECK_ACTION)];
  const keyboard = Markup.inlineKeyboard([...joinButtons, checkButton]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Telegraf middleware — gate every incoming update behind channel membership.
 * Passes through immediately when REQUIRED_JOIN_CHANNELS is empty.
 * The MEMBERSHIP_CHECK_ACTION callback always passes through so it can re-check.
 */
export function membershipGate(): MiddlewareFn<Context> {
  const channels = getRequiredChannels();
  if (channels.length === 0) {
    return (_ctx, next) => next();
  }

  return async (ctx, next) => {
    if (!ctx.from) return next();

    // Always let the "Sudah Bergabung" callback through so it can re-check.
    const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : null;
    if (cbData === MEMBERSHIP_CHECK_ACTION) return next();

    const unjoined = await findUnjoined(ctx, channels);
    if (unjoined.length === 0) return next();

    log.info({ userId: ctx.from.id, unjoined }, 'membership gate blocked');
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    await sendGateMessage(ctx, unjoined);
  };
}

/**
 * Handler for the "✅ Sudah Bergabung" callback.
 * Re-checks membership and either shows an alert or calls onSuccess.
 */
export async function handleMembershipCheck(
  ctx: Context,
  onSuccess: (ctx: Context) => Promise<void>,
): Promise<void> {
  const channels = getRequiredChannels();

  const unjoined = channels.length > 0 ? await findUnjoined(ctx, channels) : [];

  if (unjoined.length > 0) {
    const list = unjoined.join(', ');
    await ctx.answerCbQuery(`❌ Belum bergabung: ${list}`, { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('✅ Berhasil! Selamat datang 🎉');
  try { await ctx.deleteMessage(); } catch { /* already deleted */ }
  await onSuccess(ctx);
}
