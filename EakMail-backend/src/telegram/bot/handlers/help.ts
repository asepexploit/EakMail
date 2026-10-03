/**
 * /help handler — shows support info with a configurable "Hubungi CS" button.
 * The CS URL comes from bot_config.csContactUrl; when unset the button is hidden.
 * Copy from i18n catalog (bot_config-overridable via texts[locale]['help.text']).
 */
import type { Context } from 'telegraf';
import { MessageKey } from '../i18n/keys.js';
import { resolveBotContext } from '../context.js';
import { helpKeyboard } from '../keyboards.js';

export async function handleHelp(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const text = bot.tr(MessageKey.HELP_TEXT, { brandName: bot.runtime.brandName });
  const keyboard = helpKeyboard(bot.runtime.csContactUrl, bot.tr);

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}
