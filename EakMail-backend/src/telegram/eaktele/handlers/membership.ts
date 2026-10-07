/** Force-join gate untuk bot EakTele (adaptasi dari bot/handlers/membership.handler.ts). */
import type { Context, MiddlewareFn } from 'telegraf';
import { config } from '../../../config/index.js';
import { logger } from '../../../lib/logger.js';
import { S } from '../i18n/strings.js';
import { gateKeyboard } from '../keyboards.js';

const log = logger.child({ module: 'eaktele-gate' });

export const GATE_CHECK_ACTION = 'et:gate:check';

function getRequiredChannels(): string[] {
  return config.EAKTELE_REQUIRED_JOIN
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c.startsWith('@') ? c : `@${c}`));
}

async function checkMembership(ctx: Context, channel: string): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(channel, ctx.from!.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch {
    return true; // jangan blokir kalau API error
  }
}

async function findUnjoined(ctx: Context, channels: string[]): Promise<string[]> {
  const results = await Promise.all(
    channels.map(async (ch) => ({ ch, joined: await checkMembership(ctx, ch) })),
  );
  return results.filter((r) => !r.joined).map((r) => r.ch);
}

export function membershipGate(): MiddlewareFn<Context> {
  const channels = getRequiredChannels();
  if (channels.length === 0) return (_ctx, next) => next();

  return async (ctx, next) => {
    if (!ctx.from) return next();

    const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : null;
    if (cbData === GATE_CHECK_ACTION) return next();

    const unjoined = await findUnjoined(ctx, channels);
    if (unjoined.length === 0) return next();

    log.info({ userId: ctx.from.id, unjoined }, 'eaktele gate blocked');
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    await ctx.reply(
      `${S.GATE_TITLE}\n\n${S.GATE_BODY(unjoined)}`,
      { parse_mode: 'Markdown', ...gateKeyboard(unjoined) },
    );
  };
}

export async function handleGateCheck(
  ctx: Context,
  onSuccess: (ctx: Context) => Promise<void>,
): Promise<void> {
  const channels = getRequiredChannels();
  const unjoined = channels.length > 0 ? await findUnjoined(ctx, channels) : [];

  if (unjoined.length > 0) {
    await ctx.answerCbQuery(S.GATE_NOT_YET(unjoined), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery(S.GATE_WELCOME);
  try { await ctx.deleteMessage(); } catch { /* already deleted */ }
  await onSuccess(ctx);
}
