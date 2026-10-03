import { useState } from 'react';
import { PaymentStatus, type PaymentDto } from '@eakmail/shared-types';
import { Card, Select, StatusPill, DataTable, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { paymentStatusTone } from '@/lib/status-tokens';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { paymentMethodLabel, paymentStatusLabel } from '@/features/shared/enum-labels';
import { usePayments } from '@/features/payments/api/usePayments';

const statusOptions = [
  { value: '', label: strings.common.all },
  ...Object.values(PaymentStatus).map((s) => ({
    value: s,
    label: paymentStatusLabel[s],
  })),
];

function paymentType(orderId: string): { label: string; tone: 'brand' | 'info' } {
  return orderId.startsWith('topup_')
    ? { label: '💰 Top Up Saldo', tone: 'brand' }
    : { label: '📦 Pesanan', tone: 'info' };
}

/** Payments (Pembayaran) page — Pakasir transactions + top-up reconciliation. */
export function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, isError, refetch } = usePayments({ pageSize: 200 });

  const rows = (data?.items ?? []).filter(
    (p) => !statusFilter || p.status === statusFilter,
  );

  const columns: Column<PaymentDto>[] = [
    {
      key: 'created',
      header: featureStrings.payments.created,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => (
        <span className="text-text-muted">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'type',
      header: 'Jenis',
      render: (row) => {
        const { label } = paymentType(row.orderId);
        return <span className="text-sm text-text">{label}</span>;
      },
    },
    {
      key: 'order',
      header: featureStrings.payments.order,
      mono: true,
      render: (row) => {
        const isTopup = row.orderId.startsWith('topup_');
        const display = isTopup
          ? row.orderId.replace('topup_', '').slice(0, 10) + '…'
          : row.orderId.slice(0, 12) + '…';
        return (
          <span className="font-mono text-xs text-text-muted" title={row.orderId}>
            {isTopup ? 'topup:' : 'order:'}{display}
          </span>
        );
      },
    },
    {
      key: 'method',
      header: featureStrings.payments.method,
      render: (row) => (
        <span className="text-sm font-medium text-text">{paymentMethodLabel[row.method]}</span>
      ),
    },
    {
      key: 'amount',
      header: featureStrings.payments.amount,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => (
        <span className="tabular-nums font-semibold text-text">
          {formatRupiah(row.amount)}
        </span>
      ),
    },
    {
      key: 'fee',
      header: featureStrings.payments.fee,
      align: 'right',
      render: (row) =>
        row.fee === null ? (
          <span className="text-text-muted">-</span>
        ) : (
          <span className="tabular-nums text-text-muted">{formatRupiah(row.fee)}</span>
        ),
    },
    {
      key: 'status',
      header: featureStrings.payments.status,
      render: (row) => (
        <StatusPill tone={paymentStatusTone(row.status)} label={paymentStatusLabel[row.status]} />
      ),
    },
    {
      key: 'expiry',
      header: featureStrings.payments.expiry,
      align: 'right',
      render: (row) =>
        row.expiresAt ? (
          <span
            className={
              row.status === PaymentStatus.PENDING &&
              new Date(row.expiresAt).getTime() < Date.now()
                ? 'text-danger'
                : 'text-text-muted'
            }
          >
            {formatDateTime(row.expiresAt)}
          </span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.payments} description={featureStrings.payments.subtitle} />

      <Card noPadding>
        <div className="flex flex-wrap items-end gap-3 px-3 py-3">
          <div className="w-48">
            <Select
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-text-muted">
            <span>{rows.length} transaksi</span>
            <span>·</span>
            <span>
              Total:{' '}
              <span className="font-semibold text-text">
                Rp{' '}
                {formatRupiah(
                  rows
                    .filter((r) => r.status === PaymentStatus.PAID)
                    .reduce((s, r) => s + r.amount, 0),
                )}
              </span>{' '}
              berhasil
            </span>
          </div>
        </div>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          pageSize={25}
        />
      </QueryBoundary>
    </div>
  );
}
