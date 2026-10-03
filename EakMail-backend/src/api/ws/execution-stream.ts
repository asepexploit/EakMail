/**
 * WebSocket live-execution stream (ARCHITECTURE.md §9, FR-9).
 *
 * Bridges the Redis pub/sub event bus (where the engine publishes `WsEvent`s) to a
 * dashboard WebSocket. A client sends `WsSubscribe { action, executionId }`:
 *   - `subscribe` to a concrete executionId  → forward that execution's channel.
 *   - `subscribe` to the sentinel "all"       → forward the global fan-out channel.
 *   - `unsubscribe`                           → stop forwarding that channel.
 *
 * Each socket owns one dedicated ioredis subscriber connection (ioredis cannot subscribe
 * on a shared connection). Everything is torn down on socket close so no connection or
 * subscription leaks.
 */
import type { WebsocketHandler } from '@fastify/websocket';
import type { Redis } from 'ioredis';
import type { WsSubscribe } from '@eakmail/shared-types';
import { createRedis, executionChannel, GLOBAL_EXECUTION_CHANNEL } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'ws.execution-stream' });

/** Sentinel executionId that maps to the global "all live executions" feed. */
export const ALL_EXECUTIONS = 'all';

/** Resolve the Redis channel a subscribe request targets. */
function channelFor(executionId: string): string {
  return executionId === ALL_EXECUTIONS
    ? GLOBAL_EXECUTION_CHANNEL
    : executionChannel(executionId);
}

/** Parse an inbound client frame into a WsSubscribe, or null when malformed. */
function parseSubscribe(raw: unknown): WsSubscribe | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== 'object') return null;
  const { action, executionId } = parsed as Partial<WsSubscribe>;
  if (action !== 'subscribe' && action !== 'unsubscribe') return null;
  if (typeof executionId !== 'string' || executionId.length === 0) return null;
  return { action, executionId };
}

/**
 * Fastify WebSocket handler for `/ws`. One instance runs per connected socket.
 *
 * A single subscriber connection is shared across all channels this socket subscribes to;
 * a reference count per channel lets multiple subscribe requests for the same channel be
 * matched by the corresponding number of unsubscribes.
 */
export const executionStreamHandler: WebsocketHandler = (socket) => {
  const subscriber: Redis = createRedis();
  /** channel → number of active subscriptions from this socket. */
  const refCounts = new Map<string, number>();
  let closed = false;

  // Forward Redis messages to the client. When the client subscribes to both the global
  // channel (exec:all) and a per-execution channel (exec:<id>), each event would arrive
  // on both channels. To avoid sending duplicates, skip the global-channel copy when the
  // per-execution channel is also subscribed.
  subscriber.on('message', (channel, message) => {
    if (closed) return;
    if (channel === GLOBAL_EXECUTION_CHANNEL) {
      try {
        const parsed = JSON.parse(message) as { executionId?: string };
        if (parsed?.executionId && refCounts.has(executionChannel(parsed.executionId))) {
          return;
        }
      } catch { /* relay as-is if unparseable */ }
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  });

  subscriber.on('error', (err) => {
    log.error({ err }, 'ws subscriber connection error');
  });

  async function subscribe(executionId: string): Promise<void> {
    const channel = channelFor(executionId);
    const current = refCounts.get(channel) ?? 0;
    refCounts.set(channel, current + 1);
    if (current === 0) {
      await subscriber.subscribe(channel);
    }
  }

  async function unsubscribe(executionId: string): Promise<void> {
    const channel = channelFor(executionId);
    const current = refCounts.get(channel) ?? 0;
    if (current <= 0) return;
    const next = current - 1;
    if (next === 0) {
      refCounts.delete(channel);
      await subscriber.unsubscribe(channel);
    } else {
      refCounts.set(channel, next);
    }
  }

  socket.on('message', (data: unknown) => {
    const frame = parseSubscribe(String(data));
    if (!frame) {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ error: 'invalid subscribe frame' }));
      }
      return;
    }
    const op = frame.action === 'subscribe' ? subscribe : unsubscribe;
    op(frame.executionId).catch((err) => {
      log.error({ err, frame }, 'ws (un)subscribe failed');
    });
  });

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    refCounts.clear();
    // quit() unsubscribes from all channels and closes the connection gracefully.
    subscriber.quit().catch(() => subscriber.disconnect());
  };

  socket.on('close', cleanup);
  socket.on('error', (err: unknown) => {
    log.error({ err }, 'ws client socket error');
    cleanup();
  });
};
