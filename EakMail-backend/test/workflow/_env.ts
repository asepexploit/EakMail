/**
 * Test-only environment priming. Imported FIRST by workflow tests so that when
 * `src/config` loads (transitively via the Redis lib) the required vars are present.
 * The engine never connects to Redis in these tests — it uses fake publishers/stores —
 * but importing the channel-name helpers still evaluates the config module.
 */
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/eakmail_test';
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-1234567890';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.NODE_ENV ??= 'test';
process.env.USE_MOCKS ??= 'true';

export {};
