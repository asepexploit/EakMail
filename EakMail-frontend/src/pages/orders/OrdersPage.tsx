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
          Rp {formatRupiah(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: featureStrings.orders.status,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <StatusPill tone={orderStatusTone(row.status)} label={orderStatusLabel[row.status]} />
          {row.status === OrderStatus.EXPIRED && (
            <span className="text-[10px] text-danger/80">⏰ Tidak dibayar</span>
          )}
          {row.status === OrderStatus.FAILED && (
            <span className="text-[10px] text-danger/80">❌ Perlu refund</span>
          )}
        </div>
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
          { label: 'Menunggu Bayar', value: counts.pending, color: 'text-warning' },
          { label: 'Terkirim', value: counts.delivered, color: 'text-success' },
          { label: 'Kadaluarsa', value: counts.expired, color: 'text-danger' },
          { label: 'Gagal', value: counts.failed, color: 'text-danger' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="flex flex-col gap-1 p-4">
            <span className="text-xs text-text-muted">{label}</span>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
          </Card>
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
