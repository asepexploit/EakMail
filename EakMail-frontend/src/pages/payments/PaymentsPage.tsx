import type { PaymentDto } from '@eakmail/shared-types';
import { StatusPill, DataTable, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { paymentStatusTone } from '@/lib/status-tokens';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { paymentMethodLabel, paymentStatusLabel } from '@/features/shared/enum-labels';
import { usePayments } from '@/features/payments/api/usePayments';

/** Payments (Pembayaran) page — Pakasir transactions + reconciliation (DESIGN_SYSTEM.md §7.6). */
export function PaymentsPage() {
  const { data, isLoading, isError, refetch } = usePayments({ pageSize: 200 });

  const columns: Column<PaymentDto>[] = [
    {
      key: 'order',
      header: featureStrings.payments.order,
      mono: true,
      render: (row) => row.orderId,
    },
    {
      key: 'method',
      header: featureStrings.payments.method,
      render: (row) => paymentMethodLabel[row.method],
    },
    {
      key: 'amount',
      header: featureStrings.payments.amount,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => <span className="tabular-nums">{formatRupiah(row.amount)}</span>,
    },
    {
      key: 'fee',
      header: featureStrings.payments.fee,
      align: 'right',
      render: (row) => (row.fee === null ? '-' : formatRupiah(row.fee)),
    },
    {
      key: 'status',
      header: featureStrings.payments.status,
      render: (row) => (
        <StatusPill tone={paymentStatusTone(row.status)} label={paymentStatusLabel[row.status]} />
      ),
    },
    {
      key: 'txnId',
      header: featureStrings.payments.txnId,
      render: (row) => (
        <span className="font-mono text-xs text-text-muted">{row.pakasirTxnId ?? '-'}</span>
      ),
    },
    {
      key: 'expiry',
      header: featureStrings.payments.expiry,
      align: 'right',
      render: (row) => (
        <span className="text-text-muted">
          {row.expiresAt ? formatDateTime(row.expiresAt) : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.payments} description={featureStrings.payments.subtitle} />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable columns={columns} rows={data?.items ?? []} rowKey={(row) => row.id} pageSize={20} />
      </QueryBoundary>
    </div>
  );
}
