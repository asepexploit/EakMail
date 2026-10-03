/**
 * Pakasir webhook verification.
 * Pakasir sends a plain `X-Secret` header matching the secret from your project details page.
 * Comparison is constant-time to avoid timing oracles.
 * ARCHITECTURE.md §8, §10; PRD.md FR-11.
 */
import { timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';

/**
 * Returns true when the `X-Secret` header value matches PAKASIR_WEBHOOK_SECRET.
 * Constant-time comparison prevents timing-oracle attacks.
 */
export function verifyWebhookSignature(_rawBody: Buffer | string, secret: string | undefined): boolean {
  if (!config.PAKASIR_WEBHOOK_SECRET || !secret) return false;

  const expected = Buffer.from(config.PAKASIR_WEBHOOK_SECRET, 'utf8');
  const provided = Buffer.from(secret, 'utf8');

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
