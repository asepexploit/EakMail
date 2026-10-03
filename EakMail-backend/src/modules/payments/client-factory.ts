/**
 * Chooses the Pakasir client implementation: mock when config.USE_MOCKS is true,
 * the real undici client otherwise. Isolated from index.ts to avoid an import cycle
 * with the service. ARCHITECTURE.md §8.
 */
import { config } from '../../config/index.js';
import { PakasirHttpClient } from './pakasir-client.js';
import { PakasirMockClient } from './pakasir-mock.js';
import type { PakasirClient } from './pakasir-types.js';

let client: PakasirClient | null = null;

/** Singleton Pakasir client — mock when USE_MOCKS, real (undici) otherwise. */
export function getPakasirClient(): PakasirClient {
  if (client) return client;
  client = config.USE_MOCKS ? new PakasirMockClient() : new PakasirHttpClient();
  return client;
}
