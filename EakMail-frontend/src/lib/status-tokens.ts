/**
 * Maps shared-types status enums to the semantic status tokens defined in
 * DESIGN_SYSTEM.md §3.2. This is the single source of truth for how a domain
 * state is colored across Orders, Payments, Executions, Steps and Accounts.
 *
 * Tokens: success | running | warning | danger | neutral | info.
 * Labels here are the raw enum values; user-facing localized labels are the
 * responsibility of feature code (this file only decides the color tone).
 */
import {
  AccountStatus,
  BroadcastStatus,
  ExecutionState,
  OrderStatus,
  PaymentStatus,
  StepStatus,
} from '@eakmail/shared-types';

export type StatusTone =
  | 'success'
  | 'running'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info';

const orderTone: Record<OrderStatus, StatusTone> = {
  [OrderStatus.PENDING]: 'warning',
  [OrderStatus.PAID]: 'success',
  [OrderStatus.FULFILLING]: 'running',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.FAILED]: 'danger',
  [OrderStatus.REFUND_PENDING]: 'warning',
  [OrderStatus.REFUNDED]: 'neutral',
  [OrderStatus.EXPIRED]: 'neutral',
};

const paymentTone: Record<PaymentStatus, StatusTone> = {
  [PaymentStatus.PENDING]: 'warning',
  [PaymentStatus.PAID]: 'success',
  [PaymentStatus.EXPIRED]: 'neutral',
  [PaymentStatus.FAILED]: 'danger',
  [PaymentStatus.REFUNDED]: 'neutral',
};

const executionTone: Record<ExecutionState, StatusTone> = {
  [ExecutionState.PENDING]: 'warning',
  [ExecutionState.RUNNING]: 'running',
  [ExecutionState.PAUSED]: 'warning',
  [ExecutionState.SUCCEEDED]: 'success',
  [ExecutionState.FAILED]: 'danger',
  [ExecutionState.TIMED_OUT]: 'danger',
  [ExecutionState.CANCELLED]: 'neutral',
};

const stepTone: Record<StepStatus, StatusTone> = {
  [StepStatus.PENDING]: 'warning',
  [StepStatus.RUNNING]: 'running',
  [StepStatus.SUCCEEDED]: 'success',
  [StepStatus.FAILED]: 'danger',
  [StepStatus.TIMED_OUT]: 'danger',
  [StepStatus.SKIPPED]: 'neutral',
};

const accountTone: Record<AccountStatus, StatusTone> = {
  [AccountStatus.CONNECTED]: 'success',
  [AccountStatus.FLOOD_WAIT]: 'warning',
  [AccountStatus.BANNED]: 'danger',
  [AccountStatus.LOGGED_OUT]: 'neutral',
  [AccountStatus.DISCONNECTED]: 'neutral',
};

export function orderStatusTone(status: OrderStatus): StatusTone {
  return orderTone[status] ?? 'neutral';
}

export function paymentStatusTone(status: PaymentStatus): StatusTone {
  return paymentTone[status] ?? 'neutral';
}

export function executionStateTone(state: ExecutionState): StatusTone {
  return executionTone[state] ?? 'neutral';
}

export function stepStatusTone(status: StepStatus): StatusTone {
  return stepTone[status] ?? 'neutral';
}

const broadcastTone: Record<BroadcastStatus, StatusTone> = {
  [BroadcastStatus.DRAFT]: 'neutral',
  [BroadcastStatus.SENDING]: 'running',
  [BroadcastStatus.COMPLETED]: 'success',
  [BroadcastStatus.FAILED]: 'danger',
};

export function accountStatusTone(status: AccountStatus): StatusTone {
  return accountTone[status] ?? 'neutral';
}

export function broadcastStatusTone(status: BroadcastStatus): StatusTone {
  return broadcastTone[status] ?? 'neutral';
}
