/**
 * Modal for admin to top up a customer's balance and view their transaction history.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import type { CustomerDto, BalanceTransactionDto } from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Dialog } from '@/components/ui/Dialog';
import { useToasts } from '@/features/shared/useToasts';
import { formatRupiah, formatDate } from '@/lib/format';

// ---- types ------------------------------------------------------------------

interface Props {
  customer: CustomerDto;
  onClose: () => void;
}

// ---- helpers ----------------------------------------------------------------

function txTypeLabel(type: string): string {
  if (type === 'topup_admin') return 'Topup Admin';
  if (type === 'purchase') return 'Pembelian';
  if (type === 'refund_balance') return 'Refund';
  return type;
}

function txTone(type: string): string {
  if (type === 'topup_admin') return 'text-success';
  if (type === 'refund_balance') return 'text-info';
  return 'text-danger';
}

function TxRow({ tx }: { tx: BalanceTransactionDto }) {
  const isCredit = tx.amount > 0;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/40 transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {isCredit
            ? <TrendingUp className="h-3.5 w-3.5 text-success shrink-0" />
            : <TrendingDown className="h-3.5 w-3.5 text-danger shrink-0" />}
          <span className={`text-xs font-medium ${txTone(tx.type)}`}>{txTypeLabel(tx.type)}</span>
        </div>
        {tx.note && <p className="text-[11px] text-text-muted mt-0.5 ml-5">{tx.note}</p>}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums text-sm font-semibold ${isCredit ? 'text-success' : 'text-danger'}`}>
        {isCredit ? '+' : ''}{formatRupiah(tx.amount)}
      </td>
      <td className="px-3 py-2 text-right text-xs text-text-muted whitespace-nowrap">
        {formatDate(tx.createdAt)}
      </td>
    </tr>
  );
}

// ---- main component ---------------------------------------------------------

export function BalanceTopupModal({ customer, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const toast = useToasts();
  const client = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['balance-history', customer.id],
    queryFn: ({ signal }) => api.customers.balanceHistory(customer.id, signal),
  });

  const topupMutation = useMutation({
    mutationFn: () => api.customers.topupBalance(customer.id, {
      amount: parseInt(amount, 10),
      note: note.trim() || null,
    }),
    onSuccess: (data) => {
      toast.success(`Saldo berhasil ditambah. Saldo baru: ${formatRupiah(data.newBalance)}`);
      setAmount('');
      setNote('');
      void client.invalidateQueries({ queryKey: ['balance-history', customer.id] });
      void client.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: () => toast.error('Gagal menambah saldo'),
  });

  const parsedAmount = parseInt(amount, 10);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    || (customer.username ? `@${customer.username}` : customer.telegramId);

  return (
    <Dialog open onClose={onClose} title="Manajemen Saldo" size="lg">
      {/* Customer info */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-2 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <Wallet className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{displayName}</p>
          <p className="text-xs text-text-muted">ID: {customer.telegramId}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-success">{formatRupiah(customer.balance)}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Saldo saat ini</p>
        </div>
      </div>

      {/* Topup form */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tambah Saldo</p>
        <div className="flex gap-2">
          {[10000, 25000, 50000, 100000].map((preset) => (
            <button
              key={preset}
              type="button"
              className="text-xs px-2.5 py-1 rounded border border-border hover:border-brand hover:text-brand transition-colors"
              onClick={() => setAmount(String(preset))}
            >
              {formatRupiah(preset)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Nominal (Rupiah)"
              type="number"
              min={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
            />
          </div>
          <Button
            onClick={() => topupMutation.mutate()}
            disabled={!isValid}
            isLoading={topupMutation.isPending}
          >
            Tambah Saldo
          </Button>
        </div>
        <Textarea
          label="Catatan (opsional)"
          placeholder="Topup manual untuk pesanan #..."
          value={note}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Riwayat Transaksi</p>
          <button
            type="button"
            className="text-text-muted hover:text-brand transition-colors"
            onClick={() => void client.invalidateQueries({ queryKey: ['balance-history', customer.id] })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {historyQuery.isPending ? (
          <p className="text-xs text-text-muted py-4 text-center">Memuat...</p>
        ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">Belum ada transaksi.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Tipe</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Nominal</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data?.items.map((tx) => <TxRow key={tx.id} tx={tx} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
