/**
 * Maps a Payment row to the FE-safe PaymentDto.
 * Never exposes the raw provider payload or any secret. ARCHITECTURE.md §10.
 */
import type { Payment } from '@prisma/client';
import type { PaymentDto } from '@eakmail/shared-types';
import type { PaymentMethod, PaymentStatus } from '@eakmail/shared-types';

export function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method as PaymentMethod,
    amount: payment.amount,
    fee: payment.fee,
    status: payment.status as PaymentStatus,
    pakasirTxnId: payment.pakasirTxnId,
    qrString: payment.qrString,
    vaNumber: payment.vaNumber,
    paymentUrl: payment.paymentUrl,
    expiresAt: payment.expiresAt ? payment.expiresAt.toISOString() : null,
  };
}
