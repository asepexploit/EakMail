/**
 * Parses raw Pakasir responses/webhooks into our normalized shapes.
 * Pure functions only — no network, no DB. Kept separate from the client so the
 * (defensive) field-mapping logic is unit-testable in isolation. ARCHITECTURE.md §8.
 */
import { PaymentMethod, PaymentStatus } from '@eakmail/shared-types';
import type { PakasirTransaction, PakasirWebhookEvent } from './pakasir-types.js';

/** Safely read a nested transaction object from a create-transaction response. */
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = source[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = source[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function parseExpiry(source: Record<string, unknown>): Date | null {
  const raw = firstString(source, ['expired_at', 'expires_at', 'expiry', 'expire_at']);
  if (!raw) return null;
  // Pakasir returns timestamps in WIB (UTC+7) without a timezone offset indicator,
  // e.g. "2026-10-02 22:16:00". JavaScript's Date.parse treats bare strings as UTC,
  // which would shift the displayed time by +7 hours. We append the offset explicitly.
  const normalised = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !raw.includes('+') && !raw.endsWith('Z')
    ? raw.replace(' ', 'T') + '+07:00'
    : raw;
  const d = new Date(normalised);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Map a create-transaction response body into a PakasirTransaction.
 * Pakasir wraps the transaction under `transaction` (or returns it flat); we
 * accept both and pull method-specific fields (qr / VA number / payment URL).
 */
export function parseCreateTransaction(
  body: unknown,
  requested: { orderId: string; method: PaymentMethod; amount: number },
): PakasirTransaction {
  const root = record(body);
  const txn = record(root.transaction ?? root.data ?? root);

  const txnId = firstString(txn, ['id', 'transaction_id', 'txn_id', 'trx_id']);
  if (!txnId) {
    throw new Error('Pakasir response missing transaction id');
  }

  return {
    txnId,
    method: requested.method,
    amount: firstNumber(txn, ['amount', 'total']) ?? requested.amount,
    fee: firstNumber(txn, ['fee', 'admin_fee']),
    qrString: firstString(txn, ['qr_string', 'qris_string', 'qr', 'qris']),
    vaNumber: firstString(txn, ['va_number', 'virtual_account', 'va', 'account_number']),
    paymentUrl: firstString(txn, ['payment_url', 'payment_link', 'url', 'checkout_url']),
    expiresAt: parseExpiry(txn),
    raw: body,
  };
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  paid: PaymentStatus.PAID,
  success: PaymentStatus.PAID,
  completed: PaymentStatus.PAID,
  settled: PaymentStatus.PAID,
  pending: PaymentStatus.PENDING,
  unpaid: PaymentStatus.PENDING,
  expired: PaymentStatus.EXPIRED,
  failed: PaymentStatus.FAILED,
  cancelled: PaymentStatus.FAILED,
  canceled: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
};

/** Normalize a provider status string to our PaymentStatus (defaults to PENDING). */
export function mapStatus(raw: string | null): PaymentStatus {
  if (!raw) return PaymentStatus.PENDING;
  return STATUS_MAP[raw.toLowerCase()] ?? PaymentStatus.PENDING;
}

/**
 * Parse a (already signature-verified) webhook JSON body into a PakasirWebhookEvent.
 * Pakasir posts order_id + status; we map the status to our enum.
 */
export function parseWebhook(body: unknown): PakasirWebhookEvent {
  const root = record(body);
  const data = record(root.data ?? root.transaction ?? root);

  const orderId = firstString(data, ['order_id', 'orderId', 'order']);
  if (!orderId) {
    throw new Error('Pakasir webhook missing order_id');
  }

  return {
    orderId,
    txnId: firstString(data, ['id', 'transaction_id', 'txn_id', 'trx_id']),
    status: mapStatus(firstString(data, ['status', 'payment_status'])),
    amount: firstNumber(data, ['amount', 'total']),
    fee: firstNumber(data, ['fee', 'admin_fee']),
    raw: body,
  };
}
