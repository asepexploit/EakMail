/**
 * Pakasir webhook verification.
 * Pakasir sends a plain `X-Secret` header matching the secret from your project details page.
 * Comparison is constant-time to avoid timing oracles.
 * ARCHITECTURE.md §8, §10; PRD.md FR-11.
 */
import { timingSafeEqual } from 'node:crypto';
import { resolvePakasirConfig } from './pakasir-config.js';

/**
 * Returns true when the `X-Secret` header matches the active webhook secret
 * (resolved from DB override or .env). Async because config may come from DB.
 */
export async function verifyWebhookSignature(
  _rawBody: Buffer | string,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret) return false;
  const cfg = await resolvePakasirConfig();
  if (!cfg.webhookSecret) return false;

  const expected = Buffer.from(cfg.webhookSecret, 'utf8');
  const provided = Buffer.from(secret, 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
