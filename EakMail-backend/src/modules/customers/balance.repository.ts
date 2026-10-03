/**
 * Balance transaction data access. Owns atomic credit/debit of Customer.balance and the
 * corresponding BalanceTransaction audit row. All mutations go through $transaction so
 * the cached balance and the transaction log are never out of sync.
 */
import { prisma } from '../../db/client.js';

export type BalanceTxType = 'topup_admin' | 'purchase' | 'refund_balance';

export interface AddBalanceTxInput {
  customerId: string;
  amount: number;        // positive = credit, negative = debit
  type: BalanceTxType;
  orderId?: string | null;
  note?: string | null;
}

export interface BalanceTxRecord {
  id: string;
  customerId: string;
  amount: number;
  type: string;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
}

export const balanceRepository = {
  /**
   * Credit or debit the customer's balance atomically. Returns the new balance.
   * Throws if `amount` would push balance below 0 (debit guard).
   */
  async adjust(input: AddBalanceTxInput): Promise<{ newBalance: number; txId: string }> {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: input.customerId },
        select: { balance: true },
      });

      const newBalance = customer.balance + input.amount;
      if (newBalance < 0) {
        throw new Error(`Saldo tidak cukup. Saldo saat ini: ${customer.balance}, dibutuhkan: ${-input.amount}`);
      }

      await tx.customer.update({
        where: { id: input.customerId },
        data: { balance: newBalance },
      });

      const txRow = await tx.balanceTransaction.create({
        data: {
          customerId: input.customerId,
          amount: input.amount,
          type: input.type,
          orderId: input.orderId ?? null,
          note: input.note ?? null,
        },
      });

      return { newBalance, txId: txRow.id };
    });
  },

  /** List transactions for one customer, newest first. */
  listByCustomer(customerId: string, take = 100): Promise<BalanceTxRecord[]> {
    return prisma.balanceTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },
};
