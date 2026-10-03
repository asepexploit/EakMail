import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const statusOptions = [
  { value: '', label: strings.common.all },
  ...Object.values(OrderStatus).map((status) => ({
    value: status,
    label: orderStatusLabel[status],
  })),
];

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

  const columns: Column<OrderDto>[] = [
    {
      key: 'id',
      header: featureStrings.orders.id,
      mono: true,
      render: (row) => row.id,
    },
    {
      key: 'customer',
      header: featureStrings.orders.customer,
      render: (row) => <span className="font-mono text-[13px] text-text-muted">{row.customerId}</span>,
    },
    {
      key: 'product',
      header: featureStrings.orders.product,
      render: (row) => <span className="font-mono text-[13px] text-text-muted">{row.productId}</span>,
    },
    {
      key: 'amount',
      header: featureStrings.orders.amount,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => <span className="tabular-nums">{formatRupiah(row.amount)}</span>,
    },
    {
      key: 'status',
      header: featureStrings.orders.status,
      render: (row) => (
        <StatusPill tone={orderStatusTone(row.status)} label={orderStatusLabel[row.status]} />
      ),
    },
    {
      key: 'created',
      header: featureStrings.orders.created,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => <span className="text-text-muted">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.orders} description={featureStrings.orders.subtitle} />

      <Card noPadding>
        <div className="flex flex-wrap items-end gap-3 px-3 py-3">
          <div className="w-48">
            <Select
              label={featureStrings.orders.filterStatus}
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          onRowClick={openOrder}
          pageSize={20}
        />
      </QueryBoundary>

      <OrderDetailDrawer orderId={selectedOrderId} onClose={closeOrder} />
    </div>
  );
}
