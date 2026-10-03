import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './webhook-verify.js';

const SECRET = 'test-webhook-secret'; // matches test-setup.ts stub

describe('verifyWebhookSignature', () => {
  it('accepts the correct X-Secret value', () => {
    expect(verifyWebhookSignature(Buffer.from('body'), SECRET)).toBe(true);
  });

  it('accepts the correct secret with string body (body is ignored)', () => {
    expect(verifyWebhookSignature('any body', SECRET)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyWebhookSignature('body', 'wrong-secret')).toBe(false);
  });

  it('rejects an empty secret', () => {
    expect(verifyWebhookSignature('body', '')).toBe(false);
  });

  it('rejects undefined secret', () => {
    expect(verifyWebhookSignature('body', undefined)).toBe(false);
  });
});
