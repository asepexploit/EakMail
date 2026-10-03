/**
 * Redis connections + pub/sub channel names.
 * BullMQ broker, distributed locks, and the live-event pub/sub bus (ARCHITECTURE.md §7, §9).
 */
import IORedis from 'ioredis';
import { config } from '../config/index.js';

/** Shared connection for general use (locks, counters). */
export const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Dedicated publisher/subscriber (ioredis requires a separate connection to subscribe).
 * `enableReadyCheck: false` stops ioredis from issuing an `INFO` command on ready — once
 * the connection enters subscriber mode, INFO throws "Connection in subscriber mode".
 */
export function createRedis(): IORedis {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/** Redis pub/sub channel carrying WsEvent payloads for a given execution. */
export function executionChannel(executionId: string): string {
  return `exec:${executionId}`;
}

/** Channel carrying live control commands (pause/resume/...) to a running execution. */
export function executionCommandChannel(executionId: string): string {
  return `exec-cmd:${executionId}`;
}

/** Global channel that fans out every execution event (dashboard "all live executions"). */
export const GLOBAL_EXECUTION_CHANNEL = 'exec:all';
