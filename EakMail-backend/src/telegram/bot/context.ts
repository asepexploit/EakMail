/**
 * Per-update helper: resolves the Customer, their language, a bound translator, and the
 * runtime bot config from a Telegraf context. Handlers call `resolveBotContext(ctx)` so
 * each one stays thin and none re-implements customer lookup or i18n wiring.
 *
 * The bot is stateless — all per-customer state lives in the DB (TASKS Phase 3a).
 */
import type { Context } from 'telegraf';
import type { Customer } from '@prisma/client';
import { DEFAULT_LANGUAGE, type Language } from '@eakmail/shared-types';
import { translator, type Translator } from './i18n/index.js';
import { getRuntimeConfig, type BotRuntimeConfig } from './runtime-config.js';
import * as customerRepository from './customer.repository.js';

export interface BotContext {
  customer: Customer;
  language: Language;
  /** Bound translator: t(key, vars?) using the customer's language + config overrides. */
  tr: Translator;
  runtime: BotRuntimeConfig;
}

/** Telegram numeric ids are stored as strings (schema: Customer.telegramId String). */
function telegramIdOf(ctx: Context): string | null {
  const id = ctx.from?.id;
  return id === undefined ? null : String(id);
}

/**
 * Pull the capturable profile fields off the Telegram sender (ctx.from). Telegram omits
 * optional fields, so absent ones map to null and are refreshed accordingly on every contact.
 */
function profileOf(ctx: Context): customerRepository.CustomerProfile {
  const from = ctx.from;
  return {
    username: from?.username ?? null,
    firstName: from?.first_name ?? null,
    lastName: from?.last_name ?? null,
  };
}

/**
 * Build the per-update context: get-or-create the customer, load runtime config, and
 * bind a translator to the customer's language with bot_config text overrides applied.
 * Returns null when the update has no sender (e.g. channel posts) so handlers can bail.
 */
export async function resolveBotContext(ctx: Context): Promise<BotContext | null> {
  const telegramId = telegramIdOf(ctx);
  if (!telegramId) return null;

  const [customer, runtime] = await Promise.all([
    customerRepository.getOrCreateByTelegramId(telegramId, profileOf(ctx)),
    getRuntimeConfig(),
  ]);

  const language = (customer.language ?? DEFAULT_LANGUAGE) as Language;
  const tr = translator(language, runtime.textOverrides);

  return { customer, language, tr, runtime };
}
