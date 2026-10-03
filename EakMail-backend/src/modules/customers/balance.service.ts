/**
 * Balance business logic — admin topup and purchase deduction.
 * Owns: credit from admin, debit on balance-pay order, refund back to balance.
 */
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { customerRepository } from './customer.repository.js';
import { balanceRepository } from './balance.repository.js';

const log = logger.child({ module: 'balance-service' });

export interface BalanceTxDto {
  id: string;
  customerId: string;
  amount: number;
  type: string;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

function toDto(row: Awaited<ReturnType<typeof balanceRepository.listByCustomer>>[number]): BalanceTxDto {
  return {
    id: row.id,
    customerId: row.customerId,
    amount: row.amount,
    type: row.type,
    orderId: row.orderId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export const balanceService = {
  /** Admin credits a customer's balance. */
  async topup(customerId: string, amount: number, note?: string): Promise<{ newBalance: number }> {
    if (amount <= 0) throw new Error('Amount must be positive');
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError('Customer');

    const { newBalance } = await balanceRepository.adjust({
      customerId,
      amount,
      type: 'topup_admin',
      note: note ?? null,
    });
    log.info({ customerId, amount, newBalance }, 'admin balance topup');
    return { newBalance };
  },

  /** Deduct balance for a purchase. Returns false if balance insufficient (caller should 400). */
  async deductForPurchase(customerId: string, amount: number, orderId: string): Promise<boolean> {
    try {
      await balanceRepository.adjust({
        customerId,
        amount: -amount,
        type: 'purchase',
        orderId,
      });
      return true;
    } catch {
      return false;
    }
  },

  /** Return the purchase amount back to balance (order failed). Idempotent guard: skip if
   *  a refund_balance tx for this orderId already exists. */
  async refundToBalance(customerId: string, amount: number, orderId: string): Promise<void> {
    await balanceRepository.adjust({
      customerId,
      amount,
      type: 'refund_balance',
      orderId,
      note: 'Refund pesanan gagal',
    });
    log.info({ customerId, amount, orderId }, 'balance refund applied');
  },

  /** Balance transaction history for one customer. */
  async listTransactions(customerId: string): Promise<BalanceTxDto[]> {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError('Customer');
    const rows = await balanceRepository.listByCustomer(customerId);
    return rows.map(toDto);
  },
};
