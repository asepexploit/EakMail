import { useState } from 'react';
import { OrderStatus, type OrderDto } from '@eakmail/shared-types';
import { Card, Select, StatusPill, DataTable, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { orderStatusTone } from '@/lib/status-tokens';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { orderStatusLabel } from '@/features/shared/enum-labels';
import { useOrders } from '@/features/orders/api/useOrders';
import { OrderDetailDrawer } from '@/features/orders/components/OrderDetailDrawer';
import { useSearchParams } from 'react-router-dom';

const statusOptions = [
  { value: '', label: strings.common.all },
  ...Object.values(OrderStatus).map((status) => ({
    value: status,
    label: orderStatusLabel[status],
  })),
];

/** Shorten a UUID for display without losing identity at a glance. */
function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

/** Orders (Pesanan) page — DataTable + filters + detail drawer (DESIGN_SYSTEM.md §7.5). */
export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, refetch } = useOrders({
    pageSize: 200,
    status: status || undefined,
  });

  const selectedOrderId = params.get('order');

  function openOrder(order: OrderDto) {
    const next = new URLSearchParams(params);
    next.set('order', order.id);
    setParams(next);
  }

  function closeOrder() {
    const next = new URLSearchParams(params);
    next.delete('order');
    setParams(next);
  }

  const rows = data?.items ?? [];

  const columns: Column<OrderDto>[] = [
    {
      key: 'created',
      header: featureStrings.orders.created,
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => (
        <span className="whitespace-nowrap text-text-muted">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'id',
      header: featureStrings.orders.id,
      render: (row) => (
        <span className="font-mono text-xs text-text-muted" title={row.id}>
          {shortId(row.id)}
        </span>
      ),
    },
    {
      key: 'customer',
      header: featureStrings.orders.customer,
      render: (row) => (
        <span className="font-medium text-text" title={row.customerId}>
          {row.customerName ?? (
            <span className="font-mono text-xs text-text-muted">{shortId(row.customerId)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'product',
      header: featureStrings.orders.product,
      render: (row) => (
        <span className="font-medium text-text" title={row.productId}>
          {row.productName}
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'center',
      render: (row) => (
        <span className="tabular-nums text-text-muted">{row.quantity}×</span>
      ),
    },
    {
      key: 'amount',
      header: featureStrings.orders.amount,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums font-semibold text-text">
          {formatRupiah(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: featureStrings.orders.status,
      render: (row) => (
        <StatusPill tone={orderStatusTone(row.status)} label={orderStatusLabel[row.status]} />
      ),
    },
  ];

  // Summary counts
  const counts = {
    pending: rows.filter((r) => r.status === OrderStatus.PENDING).length,
    delivered: rows.filter((r) => r.status === OrderStatus.DELIVERED).length,
    expired: rows.filter((r) => r.status === OrderStatus.EXPIRED).length,
    failed: rows.filter((r) => r.status === OrderStatus.FAILED).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.orders} description={featureStrings.orders.subtitle} />

      {/* Quick-stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Menunggu Bayar', value: counts.pending, accent: 'border-l-warning', color: 'text-warning' },
          { label: 'Terkirim', value: counts.delivered, accent: 'border-l-success', color: 'text-success' },
          { label: 'Kadaluarsa', value: counts.expired, accent: 'border-l-danger', color: 'text-danger' },
          { label: 'Gagal', value: counts.failed, accent: 'border-l-danger', color: 'text-danger' },
        ].map(({ label, value, accent, color }) => (
          <div
            key={label}
            className={`elevation-1 rounded-md border border-border bg-surface border-l-4 ${accent} p-4`}
          >
            <p className={`text-3xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
            <p className="mt-1.5 text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      <Card noPadding>
        <div className="flex flex-wrap items-end gap-3 px-3 py-3">
          <div className="w-52">
            <Select
              label={featureStrings.orders.filterStatus}
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          <div className="ml-auto text-sm text-text-muted">
            {rows.length} pesanan
          </div>
        </div>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={openOrder}
          pageSize={20}
        />
      </QueryBoundary>

      <OrderDetailDrawer orderId={selectedOrderId} onClose={closeOrder} />
    </div>
  );
}
