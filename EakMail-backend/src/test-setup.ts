/**
 * Global test setup — provides minimal env so config/index.ts validates without a real DB.
 * Tests that need specific env values override them via vi.stubEnv() in their own describe block.
 */
import { vi } from 'vitest';

vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-ok!!');
vi.stubEnv('PAKASIR_WEBHOOK_SECRET', 'test-webhook-secret');
