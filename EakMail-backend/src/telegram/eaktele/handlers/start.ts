/** /start handler + menu utama EakTele. */
import type { Context } from 'telegraf';
import { S } from '../i18n/strings.js';
import { mainMenuKeyboard } from '../keyboards.js';
import { getOrCreateByTelegramId } from '../../bot/customer.repository.js';

const BRAND = 'EakTele';

export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // Upsert customer (reuse tabel Customer yang sama dengan EakMail)
  await getOrCreateByTelegramId(String(ctx.from.id), {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
  });

  await ctx.reply(S.WELCOME(BRAND), {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
}
