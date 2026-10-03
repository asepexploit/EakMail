/**
 * Bot config business logic (F17; PRD.md §5.4a). Owns get/update of the single
 * storefront BotConfig row: branding, per-locale texts, menu buttons, and the
 * write-only bot token (encrypted at rest, never echoed back — ARCHITECTURE.md §10).
 * Takes/returns plain DTOs — never Fastify objects (backend-guide.md §2).
 */
import type {
  BotConfigDto,
  BotMenuButton,
  Language,
  UpdateBotConfigRequest,
} from '@eakmail/shared-types';
import type { BotConfig, Prisma } from '@prisma/client';
import { encrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import * as repository from './bot-config.repository.js';

const log = logger.child({ module: 'bot-config' });

type LocaleTexts = Record<Language, Record<string, string>>;

/** Coerce the stored Json `texts` into the typed per-locale record. */
function readTexts(value: Prisma.JsonValue): LocaleTexts {
  const raw = (value ?? {}) as Partial<LocaleTexts>;
  return {
    id: raw.id ?? {},
    en: raw.en ?? {},
  };
}

/** Coerce the stored Json `menu` into typed menu buttons. */
function readMenu(value: Prisma.JsonValue): BotMenuButton[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as BotMenuButton[];
}

function toDto(row: BotConfig): BotConfigDto {
  return {
    id: row.id,
    brandName: row.brandName,
    logoUrl: row.logoUrl,
    startPhotoUrl: row.startPhotoUrl,
    csContactUrl: row.csContactUrl,
    topupSuccessImageUrl: row.topupSuccessImageUrl,
    botTokenSet: Boolean(row.botTokenEnc),
    menu: readMenu(row.menu),
    texts: readTexts(row.texts),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shallow-merge inbound per-locale texts over the stored set (per locale, per key). */
function mergeTexts(current: LocaleTexts, incoming: UpdateBotConfigRequest['texts']): LocaleTexts {
  if (!incoming) return current;
  return {
    id: { ...current.id, ...(incoming.id ?? {}) },
    en: { ...current.en, ...(incoming.en ?? {}) },
  };
}

export async function getBotConfig(): Promise<BotConfigDto> {
  const row = await repository.getSingleton();
  return toDto(row);
}

export async function updateBotConfig(
  input: UpdateBotConfigRequest,
): Promise<BotConfigDto> {
  const current = await repository.getSingleton();

  const data: Prisma.BotConfigUpdateInput = {};

  if (input.brandName !== undefined) data.brandName = input.brandName;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.startPhotoUrl !== undefined) data.startPhotoUrl = input.startPhotoUrl;
  if (input.csContactUrl !== undefined) data.csContactUrl = input.csContactUrl;
  if (input.topupSuccessImageUrl !== undefined) data.topupSuccessImageUrl = input.topupSuccessImageUrl;
  if (input.menu !== undefined) {
    data.menu = input.menu as unknown as Prisma.InputJsonValue;
  }
  if (input.texts !== undefined) {
    const merged = mergeTexts(readTexts(current.texts), input.texts);
    data.texts = merged as unknown as Prisma.InputJsonValue;
  }
  // Write-only: encrypt to botTokenEnc; never stored or returned in plaintext.
  if (input.botToken) {
    data.botTokenEnc = encrypt(input.botToken);
    log.info('storefront bot token updated');
  }

  const updated = await repository.update(current.id, data);
  return toDto(updated);
}
