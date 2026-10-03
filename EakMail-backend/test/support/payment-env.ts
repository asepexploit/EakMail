/**
 * Test-only env priming for the payment tests. Imported FIRST (before anything that loads
 * src/config) so the webhook secret is present when the config singleton is built. The
 * signature-verify path reads config.PAKASIR_WEBHOOK_SECRET at module-eval time.
 */
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/eakmail_test';
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-1234567890';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.NODE_ENV ??= 'test';
process.env.USE_MOCKS ??= 'true';
process.env.PAKASIR_WEBHOOK_SECRET ??= 'test-webhook-secret';

export const WEBHOOK_SECRET = process.env.PAKASIR_WEBHOOK_SECRET;

export {};
