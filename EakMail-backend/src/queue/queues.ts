/**
 * BullMQ queue definitions + job payload shapes (ARCHITECTURE.md §7).
 * FROZEN contract between producers (API/payment) and consumers (workers).
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';

export const QueueName = {
  ORDER_FULFILLMENT: 'order-fulfillment',
  WORKFLOW_RUN: 'workflow-run',
  PAYMENT_POLL: 'payment-poll',
  NOTIFICATIONS: 'notifications',
  PROMOTION: 'promotion',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

// ---- Job payloads ------------------------------------------------------------

export interface OrderFulfillmentJob {
  orderId: string;
}
export interface WorkflowRunJob {
  /** Pre-created execution row to run into. The worker MUST reuse this (not create a new
   *  one) so the id the API returned to the dashboard matches the one that emits events. */
  executionId: string;
  workflowId: string;
  orderId: string | null;
  accountId: string | null;
  mode: 'PRODUCTION' | 'TEST';
  variables: Record<string, string>;
}
export interface PaymentPollJob {
  orderId: string;
}
export interface NotificationJob {
  customerTelegramId: string;
  text: string;
  /** When set, the worker will also edit this message to remove its inline keyboard. */
  editChatId?: string;
  editMessageId?: number;
  /** When set, the worker will also replace the edited message's photo with this URL. */
  editSuccessImageUrl?: string | null;
}

export interface PromotionJob {
  campaignId: string;
}

export interface JobPayloadMap {
  'order-fulfillment': OrderFulfillmentJob;
  'workflow-run': WorkflowRunJob;
  'payment-poll': PaymentPollJob;
  notifications: NotificationJob;
  promotion: PromotionJob;
}

/** BullMQ connection (separate ioredis instance per BullMQ best practice). */
export function bullConnection(): IORedis {
  return new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
}

let queues: Record<QueueName, Queue> | null = null;

export function getQueues(): Record<QueueName, Queue> {
  if (queues) return queues;
  const connection = bullConnection();
  queues = {
    'order-fulfillment': new Queue(QueueName.ORDER_FULFILLMENT, { connection }),
    'workflow-run': new Queue(QueueName.WORKFLOW_RUN, { connection }),
    'payment-poll': new Queue(QueueName.PAYMENT_POLL, { connection }),
    notifications: new Queue(QueueName.NOTIFICATIONS, { connection }),
    promotion: new Queue(QueueName.PROMOTION, { connection }),
  };
  return queues;
}
