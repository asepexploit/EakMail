/**
 * Internal Pakasir integration types (module-private).
 * The wire contract for create-transaction and webhooks lives here so the client,
 * the mock, and the service all agree on one shape. ARCHITECTURE.md §8.
 */
import type { PaymentMethod, PaymentStatus } from '@eakmail/shared-types';

/** Input to a create-transaction call. */
export interface CreateTransactionInput {
  orderId: string;
  method: PaymentMethod;
  amount: number; // Rupiah
}

/**
 * Normalized result of a create-transaction call, parsed from the provider
 * response into the fields we persist on `Payment`. Only one of qrString /
 * vaNumber / paymentUrl is typically populated depending on the method.
 */
export interface PakasirTransaction {
  txnId: string;
  method: PaymentMethod;
  amount: number;
  fee: number | null;
  qrString: string | null;
  vaNumber: string | null;
  paymentUrl: string | null;
  expiresAt: Date | null;
  /** Raw provider payload, stored for reconciliation/debugging (never returned to FE). */
  raw: unknown;
}

/** The client seam: real (undici) and mock implementations both satisfy this. */
export interface PakasirClient {
  createTransaction(input: CreateTransactionInput): Promise<PakasirTransaction>;
}

/** Decoded, signature-verified webhook event from Pakasir. */
export interface PakasirWebhookEvent {
  orderId: string;
  txnId: string | null;
  status: PaymentStatus;
  amount: number | null;
  fee: number | null;
  raw: unknown;
}
