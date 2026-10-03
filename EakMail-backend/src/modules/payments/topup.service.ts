/**
 * Topup service — handles customer balance top-up via Pakasir QRIS.
 * Flow: createTopup → Pakasir QRIS → webhook PAID → settleTopup → credit balance.
 */
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { getPakasirClient } from './client-factory.js';
import { parseCreateTransaction } from './pakasir-parser.js';
import { balanceService } from '../customers/balance.service.js';
import { PaymentMethod } from '@eakmail/shared-types';

const log = logger.child({ module: 'topup-service' });

const MIN_TOPUP = 5_000;
const MAX_TOPUP = 10_000_000;

export interface TopupResult {
  topupId: string;
  qrString: string | null;
  paymentUrl: string | null;
  amount: number;
  expiresAt: Date | null;
}

export async function createTopup(customerId: string, amount: number): Promise<TopupResult> {
  if (amount < MIN_TOPUP || amount > MAX_TOPUP) {
    throw new Error(`Jumlah topup harus antara ${MIN_TOPUP} dan ${MAX_TOPUP}`);
  }

  const topup = await prisma.topupRequest.create({
    data: { customerId, amount, status: 'PENDING' },
  });

  // Use topup id as the Pakasir order_id (prefixed to avoid collision with real orders).
  const txn = await getPakasirClient().createTransaction({
    orderId: `topup_${topup.id}`,
    method: PaymentMethod.QRIS,
    amount,
  });

  await prisma.topupRequest.update({
    where: { id: topup.id },
    data: {
      pakasirTxnId: txn.txnId,
      qrString: txn.qrString,
      expiresAt: txn.expiresAt,
    },
  });

  log.info({ topupId: topup.id, amount }, 'topup request created');
  return {
    topupId: topup.id,
    qrString: txn.qrString,
    paymentUrl: txn.paymentUrl,
    amount,
    expiresAt: txn.expiresAt,
  };
}

/**
 * Called from the payment webhook when orderId starts with "topup_".
 * Credits the balance and marks the TopupRequest as PAID.
 */
export async function settleTopupByOrderId(pakasirOrderId: string): Promise<void> {
  const topupId = pakasirOrderId.replace(/^topup_/, '');
  const topup = await prisma.topupRequest.findUnique({ where: { id: topupId } });
  if (!topup) {
    log.warn({ pakasirOrderId }, 'settleTopup: topup request not found');
    return;
  }
  if (topup.status === 'PAID') {
    log.info({ topupId }, 'settleTopup: already settled — idempotent skip');
    return;
  }

  await prisma.topupRequest.update({
    where: { id: topupId },
    data: { status: 'PAID', settledAt: new Date() },
  });

  await balanceService.topup(topup.customerId, topup.amount, `Topup via QRIS (${topupId})`);
  log.info({ topupId, customerId: topup.customerId, amount: topup.amount }, 'topup settled — balance credited');
}

/**
 * Cancel a PENDING topup request. Returns false if not found or already settled/expired.
 */
export async function cancelTopup(topupId: string, customerId: string): Promise<boolean> {
  const changed = await prisma.topupRequest.updateMany({
    where: { id: topupId, customerId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });
  return changed.count > 0;
}

export { MIN_TOPUP, MAX_TOPUP };
