/**
 * Shared enums — the single source of truth for all state names across FE + BE.
 * Mirrors the state machines in ARCHITECTURE.md §6.3 and BLUEPRINT.md §5.2.
 * See .claude/rules/shared-types.md and naming-conventions.md.
 */

/** Supported storefront-bot languages (BLUEPRINT.md §4, PRD.md §5.9). Default is `id`. */
export const Language = {
  ID: 'id',
  EN: 'en',
} as const;
export type Language = (typeof Language)[keyof typeof Language];
export const DEFAULT_LANGUAGE: Language = Language.ID;

/** Order lifecycle (BLUEPRINT.md §5.2). */
export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FULFILLING: 'FULFILLING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Payment status (Pakasir; ARCHITECTURE.md §8). */
export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Pakasir payment methods (ARCHITECTURE.md §8, PRD.md §8). */
export const PaymentMethod = {
  QRIS: 'qris',
  BRI_VA: 'bri_va',
  BNI_VA: 'bni_va',
  CIMB_NIAGA_VA: 'cimb_niaga_va',
  PERMATA_VA: 'permata_va',
  MAYBANK_VA: 'maybank_va',
  BNC_VA: 'bnc_va',
  ARTHA_GRAHA_VA: 'artha_graha_va',
  SAMPOERNA_VA: 'sampoerna_va',
  PAYMENT_LINK: 'payment_link',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Execution lifecycle (ARCHITECTURE.md §6.3). */
export const ExecutionState = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  TIMED_OUT: 'TIMED_OUT',
  CANCELLED: 'CANCELLED',
} as const;
export type ExecutionState = (typeof ExecutionState)[keyof typeof ExecutionState];

/** Per-node step status within an execution. */
export const StepStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  TIMED_OUT: 'TIMED_OUT',
  SKIPPED: 'SKIPPED',
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

/** Telegram user-account (MTProto) health (ARCHITECTURE.md §4.2). */
export const AccountStatus = {
  CONNECTED: 'CONNECTED',
  FLOOD_WAIT: 'FLOOD_WAIT',
  BANNED: 'BANNED',
  LOGGED_OUT: 'LOGGED_OUT',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

/** Whether an execution is a real order fulfillment or an admin test run. */
export const ExecutionMode = {
  PRODUCTION: 'PRODUCTION',
  TEST: 'TEST',
} as const;
export type ExecutionMode = (typeof ExecutionMode)[keyof typeof ExecutionMode];

/** Broadcast lifecycle (customer messaging). */
export const BroadcastStatus = {
  DRAFT: 'DRAFT',
  SENDING: 'SENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type BroadcastStatus = (typeof BroadcastStatus)[keyof typeof BroadcastStatus];

/** How a product's stock is tracked (PRD.md §5.4). */
export const StockMode = {
  /** Always use supplier workflow — no local stock. */
  WORKFLOW: 'workflow',
  /** Use local stock items only — fail order when stock empty. */
  STOCK_ONLY: 'stock_only',
  /** Use local stock items first; fall back to supplier workflow when empty. */
  STOCK_WITH_FALLBACK: 'stock_with_fallback',
  /** Fulfill via the product's API supplier directly (SupplierType.API). No workflow needed. */
  API_SUPPLIER: 'api_supplier',
  /** Use local stock items first; fall back to API supplier when local stock is empty. */
  STOCK_WITH_API_FALLBACK: 'stock_with_api_fallback',
  /** Legacy aliases kept for backwards compat. */
  MANUAL: 'manual',
  UNLIMITED: 'unlimited',
} as const;
export type StockMode = (typeof StockMode)[keyof typeof StockMode];

/** How a supplier fulfills orders. BOT = drives a Telegram bot via MTProto; API = HTTP REST API. */
export const SupplierType = {
  BOT: 'bot',
  API: 'api',
} as const;
export type SupplierType = (typeof SupplierType)[keyof typeof SupplierType];

/** Promotion account connection status. */
export const PromotionAccountStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  FLOOD_WAIT: 'FLOOD_WAIT',
  BANNED: 'BANNED',
} as const;
export type PromotionAccountStatus = (typeof PromotionAccountStatus)[keyof typeof PromotionAccountStatus];

/** Promotion campaign lifecycle. */
export const CampaignStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/** How accounts are selected per campaign run. */
export const CampaignSendMode = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  ALL_ACCOUNTS: 'ALL_ACCOUNTS',
  RANDOM: 'RANDOM',
} as const;
export type CampaignSendMode = (typeof CampaignSendMode)[keyof typeof CampaignSendMode];

/** Result of a single promotion send attempt. */
export const PromotionLogStatus = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  FLOOD_WAIT: 'FLOOD_WAIT',
  SKIPPED: 'SKIPPED',
} as const;
export type PromotionLogStatus = (typeof PromotionLogStatus)[keyof typeof PromotionLogStatus];

/** Live control commands sent to a running execution (BLUEPRINT.md §10.3). */
export const ExecutionCommand = {
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  CANCEL: 'CANCEL',
  RETRY_FROM_START: 'RETRY_FROM_START',
  RETRY_FROM_FAILED: 'RETRY_FROM_FAILED',
  STEP: 'STEP',
} as const;
export type ExecutionCommand = (typeof ExecutionCommand)[keyof typeof ExecutionCommand];
