/**
 * Runtime bot configuration for the storefront bot (F17; TASKS Phase 3a "Bot driven by
 * bot_config"). Loads branding, menu, per-locale text overrides and the decrypted bot
 * token from the BotConfig singleton, and caches them with a short TTL so handlers read
 * fresh config without a DB hit per message. `refresh()` forces a reload (hot-reload on
 * dashboard change, no code deploy).
 *
 * The token is decrypted here and never returned to the browser (ARCHITECTURE.md §10);
 * it is only consumed by index.ts to construct the Telegraf client.
 */
import type { BotConfig, Prisma } from '@prisma/client';
import type { BotMenuButton, Language } from '@eakmail/shared-types';
import { prisma } from '../../db/client.js';
import { decrypt } from '../../lib/crypto.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import type { TextOverrides } from './i18n/index.js';

const log = logger.child({ module: 'bot-runtime-config' });

/** Snapshot of the bits of BotConfig the running bot needs. Token kept separate. */
export interface BotRuntimeConfig {
  brandName: string;
  logoUrl: string | null;
  /** Photo sent above welcome message on /start */
  startPhotoUrl: string | null;
  menu: BotMenuButton[];
  /** bot_config.texts merged over the static catalog by the i18n resolver. */
  textOverrides: TextOverrides;
}

const CACHE_TTL_MS = 30_000;

let cache: { value: BotRuntimeConfig; loadedAt: number } | null = null;

function readMenu(value: Prisma.JsonValue): BotMenuButton[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as BotMenuButton[];
}

function readTexts(value: Prisma.JsonValue): TextOverrides {
  const raw = (value ?? {}) as Partial<Record<Language, Record<string, string>>>;
  return { id: raw.id ?? {}, en: raw.en ?? {} };
}

function toRuntime(row: BotConfig): BotRuntimeConfig {
  return {
    brandName: row.brandName,
    logoUrl: row.logoUrl,
    startPhotoUrl: row.startPhotoUrl,
    menu: readMenu(row.menu),
    textOverrides: readTexts(row.texts),
  };
}

/** Load the BotConfig row (creating an empty singleton on first access). */
async function loadRow(): Promise<BotConfig> {
  const existing = await prisma.botConfig.findFirst();
  if (existing) return existing;
  return prisma.botConfig.create({ data: {} });
}

/** Cached runtime config; reloads after TTL. Use refresh() to force a reload. */
export async function getRuntimeConfig(): Promise<BotRuntimeConfig> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.value;
  const row = await loadRow();
  cache = { value: toRuntime(row), loadedAt: now };
  return cache.value;
}

/** Force a reload on the next getRuntimeConfig() (hot-reload after a dashboard save). */
export function invalidateRuntimeConfig(): void {
  cache = null;
}

/**
 * Resolve the storefront bot token: prefer the encrypted token in bot_config, fall back
 * to config.STOREFRONT_BOT_TOKEN. Returns null when neither is set. Never logs the token.
 */
export async function resolveBotToken(): Promise<string | null> {
  const row = await loadRow();
  if (row.botTokenEnc) {
    try {
      const token = decrypt(row.botTokenEnc);
      if (token) return token;
    } catch (err) {
      log.error({ err }, 'failed to decrypt storefront bot token; falling back to env');
    }
  }
  return config.STOREFRONT_BOT_TOKEN || null;
}
