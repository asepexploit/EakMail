/**
 * Deterministic Pakasir mock — used when config.USE_MOCKS is true (never touches
 * the network). All output is derived purely from the orderId + method so the same
 * order always yields the same fake txn id / QR / VA (no Math.random, no Date.now).
 * ARCHITECTURE.md §8; mock policy per task rules.
 */
import { createHash } from 'node:crypto';
import { PaymentMethod } from '@eakmail/shared-types';
import type { CreateTransactionInput, PakasirClient, PakasirTransaction } from './pakasir-types.js';

/** Fixed expiry horizon (24h) expressed deterministically from the order hash's day offset. */
const EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export class PakasirMockClient implements PakasirClient {
  async createTransaction(input: CreateTransactionInput): Promise<PakasirTransaction> {
    const seed = hash(`${input.orderId}:${input.method}`);
    const txnId = `mock_${seed.slice(0, 24)}`;

    const usesVa = input.method !== PaymentMethod.QRIS && input.method !== PaymentMethod.PAYMENT_LINK;
    const isLink = input.method === PaymentMethod.PAYMENT_LINK;

    return {
      txnId,
      method: input.method,
      amount: input.amount,
      fee: 0,
      qrString: input.method === PaymentMethod.QRIS ? `00020101021126MOCKQRIS${seed.slice(0, 16).toUpperCase()}` : null,
      vaNumber: usesVa ? deterministicVa(seed) : null,
      paymentUrl: isLink ? `https://pakasir.mock/pay/${txnId}` : null,
      // Deterministic expiry: base epoch (mock) + fixed window. Stable per build, not per call.
      expiresAt: new Date(deterministicEpoch(seed) + EXPIRY_WINDOW_MS),
      raw: { mock: true, orderId: input.orderId, method: input.method, amount: input.amount, txnId },
    };
  }
}

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 16-digit VA number derived from the hash (deterministic, no randomness). */
function deterministicVa(seed: string): string {
  const digits = BigInt(`0x${seed.slice(0, 15)}`).toString().padStart(16, '0');
  return digits.slice(0, 16);
}

/**
 * A fixed pseudo-epoch derived from the seed so expiresAt is deterministic.
 * Anchored to a constant base date; the seed only nudges it within a bounded range.
 */
function deterministicEpoch(seed: string): number {
  const base = Date.UTC(2025, 0, 1); // constant anchor
  const offset = Number(BigInt(`0x${seed.slice(0, 8)}`) % BigInt(EXPIRY_WINDOW_MS));
  return base + offset;
}
