/**
 * /start handler — welcome message + main menu (Phase 3a).
 * If bot_config has a startPhotoUrl, sends it as a photo first then the menu.
 * Copy comes from the i18n catalog (bot_config-overridable). No hardcoded strings.
 */
import type { Context } from 'telegraf';
import { MessageKey } from '../i18n/keys.js';
import { resolveBotContext } from '../context.js';
import { mainMenuKeyboard } from '../keyboards.js';

export async function handleStart(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const welcome = bot.tr(MessageKey.WELCOME, { brandName: bot.runtime.brandName });
  const menuTitle = bot.tr(MessageKey.MENU_TITLE);
  const text = `${welcome}\n\n${menuTitle}`;
  const keyboard = mainMenuKeyboard(bot.runtime, bot.tr);

  if (bot.runtime.startPhotoUrl) {
    try {
      await ctx.replyWithPhoto(bot.runtime.startPhotoUrl, {
        caption: text,
        parse_mode: 'Markdown',
        ...keyboard,
      });
      return;
    } catch {
      // Photo send failed (bad URL, etc.) — fall through to text reply
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
}
