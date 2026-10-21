/**
 * verifyWebhookSignature — mock resolvePakasirConfig so no DB is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./pakasir-config.js', () => ({
  resolvePakasirConfig: vi.fn(),
}));

import { resolvePakasirConfig } from './pakasir-config.js';
import { verifyWebhookSignature } from './webhook-verify.js';

const mockResolve = resolvePakasirConfig as ReturnType<typeof vi.fn>;

const SECRET = 'test-webhook-secret';

function stubSecret(s: string | null) {
  mockResolve.mockResolvedValue({ webhookSecret: s, mode: 'live', slug: 'test', baseUrl: 'https://x' });
}

describe('verifyWebhookSignature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts the correct X-Secret value', async () => {
    stubSecret(SECRET);
    await expect(verifyWebhookSignature(Buffer.from('body'), SECRET)).resolves.toBe(true);
  });

  it('accepts the correct secret with string body (body is ignored)', async () => {
    stubSecret(SECRET);
    await expect(verifyWebhookSignature('any body', SECRET)).resolves.toBe(true);
  });

  it('rejects a wrong secret', async () => {
    stubSecret(SECRET);
    await expect(verifyWebhookSignature('body', 'wrong-secret')).resolves.toBe(false);
  });

  it('rejects an empty secret', async () => {
    stubSecret(SECRET);
    await expect(verifyWebhookSignature('body', '')).resolves.toBe(false);
  });

  it('rejects undefined secret', async () => {
    stubSecret(SECRET);
    await expect(verifyWebhookSignature('body', undefined)).resolves.toBe(false);
  });

  it('rejects when no webhook secret is configured', async () => {
    stubSecret(null);
    await expect(verifyWebhookSignature('body', SECRET)).resolves.toBe(false);
  });
});
