/**
 * Dedicated BullMQ queue for customer broadcasts.
 *
 * queues.ts is a frozen contract, so the broadcast queue is defined here as a self-contained
 * unit (its own name, payload, connection, and lazily-constructed Queue) that mirrors the
 * pattern in queues.ts. Producers (broadcast.service) enqueue `{ broadcastId }`; the broadcast
 * worker consumes it and fans out the send to every target customer.
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config/index.js';

export const BROADCAST_QUEUE_NAME = 'broadcast' as const;

/** Job payload: identifies the Broadcast row to fan out. Targets are loaded by the worker. */
export interface BroadcastJob {
  broadcastId: string;
}

/** BullMQ connection (separate ioredis instance per BullMQ best practice, as in queues.ts). */
function broadcastConnection(): IORedis {
  return new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
}

let queue: Queue<BroadcastJob> | null = null;

/** Lazily-constructed singleton broadcast queue. */
export function getBroadcastQueue(): Queue<BroadcastJob> {
  if (queue) return queue;
  queue = new Queue<BroadcastJob>(BROADCAST_QUEUE_NAME, { connection: broadcastConnection() });
  return queue;
}

/** A fresh connection for the worker consumer (workers must not share the Queue's connection). */
export function broadcastWorkerConnection(): IORedis {
  return broadcastConnection();
}
