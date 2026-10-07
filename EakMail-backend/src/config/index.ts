/**
 * Environment configuration — validated at boot (TASKS.md Phase 0).
 * Local-first defaults: HOST=127.0.0.1 (FR-10). See .env.example.
 */
import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const schema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  ENCRYPTION_KEY: z.string().min(16),
  SESSION_SECRET: z.string().min(8).default('dev-session-secret'),

  TELEGRAM_API_ID: z.coerce.number().default(0),
  TELEGRAM_API_HASH: z.string().default(''),
  STOREFRONT_BOT_TOKEN: z.string().default(''),

  PAKASIR_BASE_URL: z.string().default('https://pakasir.com'),
  PAKASIR_SLUG: z.string().default(''),
  PAKASIR_API_KEY: z.string().default(''),
  PAKASIR_WEBHOOK_SECRET: z.string().default(''),

  USE_MOCKS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Comma-separated Telegram channel usernames (e.g. "@eakmails,@channel2").
  // Users must join ALL listed channels before using the storefront bot.
  // Empty = gate disabled.
  REQUIRED_JOIN_CHANNELS: z.string().default(''),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const config = loadConfig();
