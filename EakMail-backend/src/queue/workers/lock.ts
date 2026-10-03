/**
 * Minimal Redis-backed advisory lock (SET NX PX) for worker idempotency.
 * Guards the critical section of order fulfillment so two concurrent runs of the same
 * order (a redelivered BullMQ job + a manual retry) never overlap. It is *advisory*: the
 * hard exactly-once guarantee is the unique Delivery row (see order.repository); this lock
 * merely prevents wasted concurrent work and racey state transitions. ARCHITECTURE.md §7.
 */
import { redis } from '../../lib/redis.js';

export interface Lock {
  /** Release the lock iff we still hold it (token check via Lua, no accidental steal). */
  release(): Promise<void>;
}

/** Lua: delete the key only when its value matches our token (safe unlock). */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

/**
 * Try to acquire `key` for up to `ttlMs`. Returns a Lock on success, or null when the lock
 * is already held by someone else. The TTL bounds a crashed holder so the lock self-heals.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<Lock | null> {
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (ok !== 'OK') return null;
  return {
    async release() {
      try {
        await redis.eval(RELEASE_SCRIPT, 1, key, token);
      } catch {
        // Best-effort release; the TTL will expire the lock regardless.
      }
    },
  };
}

/** Redis key for the per-order fulfillment lock. */
export function orderLockKey(orderId: string): string {
  return `lock:fulfill:${orderId}`;
}
