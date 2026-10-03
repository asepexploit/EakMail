/**
 * /language handler — shows the language switcher and applies a selection, persisting
 * customer.language (Phase 3a; FR-13). The confirmation is rendered in the NEWLY chosen
 * language so the switch is immediately visible. Callback routing lives in index.ts.
 */
import type { Context } from 'telegraf';
import { Language } from '@eakmail/shared-types';
import { MessageKey } from '../i18n/keys.js';
import { translator } from '../i18n/index.js';
import { resolveBotContext } from '../context.js';
import { getRuntimeConfig } from '../runtime-config.js';
import { languageKeyboard } from '../keyboards.js';
import * as customerRepository from '../customer.repository.js';

/** /language — prompt the customer to choose a language. */
export async function handleLanguage(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;
  await ctx.reply(bot.tr(MessageKey.LANGUAGE_PROMPT), languageKeyboard(bot.tr));
}

/** Guard: is a callback value a supported language? */
export function isSupportedLanguage(value: string): value is Language {
  return value === Language.ID || value === Language.EN;
}

/**
 * Apply a language selection from an inline button. Persists the choice, then confirms in
 * the new language. Called by the "lang:<code>" callback route in index.ts.
 */
export async function applyLanguageSelection(ctx: Context, language: Language): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  await customerRepository.setLanguage(bot.customer.id, language);

  // Re-bind the translator to the newly selected language so the confirmation reflects it.
  const runtime = await getRuntimeConfig();
  const tr = translator(language, runtime.textOverrides);
  await ctx.reply(tr(MessageKey.LANGUAGE_SWITCHED));
}
