/**
 * Resolves the active Pakasir gateway configuration.
 *
 * mode = "production" → use .env values (PAKASIR_BASE_URL / SLUG / API_KEY / WEBHOOK_SECRET).
 * mode = "testing"    → use the dashboard-supplied values stored in PakasirConfig (encrypted at rest).
 *                       Falls back to env for any field left blank in the DB row.
 *
 * Called per-request so a mode switch takes effect immediately without a restart.
 */
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { decrypt, encrypt } from '../../lib/crypto.js';

export interface PakasirRuntimeConfig {
  mode: 'production' | 'testing';
  baseUrl: string;
  slug: string;
  apiKey: string;
  webhookSecret: string;
}

export async function resolvePakasirConfig(): Promise<PakasirRuntimeConfig> {
  const row = await prisma.pakasirConfig.findUnique({ where: { id: 'default' } });

  if (!row || row.mode !== 'testing') {
    return {
      mode: 'production',
      baseUrl: config.PAKASIR_BASE_URL,
      slug: config.PAKASIR_SLUG,
      apiKey: config.PAKASIR_API_KEY,
      webhookSecret: config.PAKASIR_WEBHOOK_SECRET,
    };
  }

  return {
    mode: 'testing',
    baseUrl: row.baseUrl || config.PAKASIR_BASE_URL,
    slug: row.slug || config.PAKASIR_SLUG,
    apiKey: row.apiKeyEnc ? decrypt(row.apiKeyEnc) : config.PAKASIR_API_KEY,
    webhookSecret: row.webhookSecEnc ? decrypt(row.webhookSecEnc) : config.PAKASIR_WEBHOOK_SECRET,
  };
}

/** Persist a new Pakasir config (upsert singleton). Encrypts secret fields before storage. */
export async function savePakasirConfig(input: {
  mode: 'production' | 'testing';
  baseUrl?: string;
  slug?: string;
  apiKey?: string;
  webhookSecret?: string;
}): Promise<void> {
  await prisma.pakasirConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      mode: input.mode,
      baseUrl: input.baseUrl || null,
      slug: input.slug || null,
      apiKeyEnc: input.apiKey ? encrypt(input.apiKey) : null,
      webhookSecEnc: input.webhookSecret ? encrypt(input.webhookSecret) : null,
    },
    update: {
      mode: input.mode,
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl || null }),
      ...(input.slug !== undefined && { slug: input.slug || null }),
      ...(input.apiKey !== undefined && { apiKeyEnc: input.apiKey ? encrypt(input.apiKey) : null }),
      ...(input.webhookSecret !== undefined && { webhookSecEnc: input.webhookSecret ? encrypt(input.webhookSecret) : null }),
    },
  });
}

/** Read current non-secret state for the Settings API response. */
export async function getPakasirConfigStatus() {
  const row = await prisma.pakasirConfig.findUnique({ where: { id: 'default' } });
  return {
    mode: (row?.mode ?? 'production') as 'production' | 'testing',
    baseUrl: row?.baseUrl ?? '',
    slug: row?.slug ?? '',
    apiKeySet: Boolean(row?.apiKeyEnc),
    webhookSecretSet: Boolean(row?.webhookSecEnc),
  };
}
