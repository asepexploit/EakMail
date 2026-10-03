/**
 * Session Manager factory (ARCHITECTURE.md §4.2).
 * Returns the deterministic mock when config.USE_MOCKS is true (build/CI/offline
 * tests), otherwise the real GramJS-backed manager. The engine and the accounts
 * module depend only on the frozen TelegramSessionManager seam in ./types.ts.
 */
import { config } from '../../config/index.js';
import type { TelegramSessionManager } from './types.js';
import { MockSessionManager } from './mock-session-manager.js';
import { GramjsSessionManager } from './gramjs-session-manager.js';

let instance: TelegramSessionManager | null = null;

export function getSessionManager(): TelegramSessionManager {
  if (instance) return instance;
  instance = config.USE_MOCKS ? new MockSessionManager() : new GramjsSessionManager();
  return instance;
}

/** Test/shutdown helper: drop the cached instance (next call rebuilds it). */
export function resetSessionManager(): void {
  instance = null;
}

export type { TelegramSessionManager } from './types.js';
