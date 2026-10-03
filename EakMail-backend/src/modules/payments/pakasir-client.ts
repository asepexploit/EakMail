/**
 * Real Pakasir HTTP client (undici) for create-transaction.
 * POST {PAKASIR_BASE_URL}/api/v2/create-transaction/{slug}/{order_id}
 *   headers: X-Api-Key: <key>   body: { method, amount }
 * "Find-or-create": identical (slug, order_id) requests return the same transaction,
 * so this call is naturally idempotent. Rate-limited to 2 req/s. ARCHITECTURE.md §8.
 *
 * The API key/slug are read from config and never logged or returned to callers.
 */
import { request } from 'undici';
import { logger } from '../../lib/logger.js';
import { RateLimiter } from './rate-limiter.js';
import { parseCreateTransaction } from './pakasir-parser.js';
import { resolvePakasirConfig } from './pakasir-config.js';
import type { CreateTransactionInput, PakasirClient, PakasirTransaction } from './pakasir-types.js';

const log = logger.child({ module: 'pakasir-client' });

/** Pakasir enforces 2 req/s; we cap slightly under to stay safe. */
const RATE_LIMIT_PER_SECOND = 2;
const REQUEST_TIMEOUT_MS = 15_000;

export class PakasirHttpClient implements PakasirClient {
  private readonly limiter = new RateLimiter(RATE_LIMIT_PER_SECOND);

  async createTransaction(input: CreateTransactionInput): Promise<PakasirTransaction> {
    await this.limiter.acquire();

    const cfg = await resolvePakasirConfig();
    const url = this.transactionUrl(input.orderId, cfg.baseUrl, cfg.slug);
    const res = await request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
      },
      body: JSON.stringify({ method: input.method, amount: input.amount }),
      headersTimeout: REQUEST_TIMEOUT_MS,
      bodyTimeout: REQUEST_TIMEOUT_MS,
    });

    const bodyText = await res.body.text();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // Never include the API key; log status + provider message only.
      log.error({ status: res.statusCode, orderId: input.orderId }, 'Pakasir create-transaction failed');
      throw new Error(`Pakasir create-transaction returned HTTP ${res.statusCode}`);
    }

    const parsed = safeJson(bodyText);
    return parseCreateTransaction(parsed, input);
  }

  private transactionUrl(orderId: string, baseUrl: string, slug: string): string {
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}/api/v2/create-transaction/${encodeURIComponent(slug)}/${encodeURIComponent(orderId)}`;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Pakasir returned a non-JSON response');
  }
}
