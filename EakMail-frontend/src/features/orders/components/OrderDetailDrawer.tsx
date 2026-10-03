import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { OrderStatus } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { strings } from '@/lib/strings';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { orderStatusTone, paymentStatusTone } from '@/lib/status-tokens';
import { Drawer, ConfirmDialog } from '@/components/ui';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '@/features/shared/enum-labels';
import { useCancelOrder, useOrder, useRefundOrder, useRetryOrder } from '@/features/orders/api/useOrders';
import { OrderTimeline } from './OrderTimeline.js';

export interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

/** Order detail drawer: timeline, linked execution, payment, retry/refund (DESIGN_SYSTEM.md §7.5). */
export function OrderDetailDrawer({ orderId, onClose }: OrderDetailDrawerProps) {
  const { data, isLoading, isError, refetch } = useOrder(orderId);
  const retryOrder = useRetryOrder();
  const refundOrder = useRefundOrder();
  const cancelOrder = useCancelOrder();
  const [confirm, setConfirm] = useState<'retry' | 'refund' | 'cancel' | null>(null);

  const refundable: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.FULFILLING,
    OrderStatus.FAILED,
    OrderStatus.DELIVERED,
  ];
  const retryable: OrderStatus[] = [OrderStatus.FAILED, OrderStatus.FULFILLING];
  const canRefund = data && refundable.includes(data.status);
  const canRetry = data && retryable.includes(data.status);
  const canCancel = data && data.status === OrderStatus.PENDING;

  return (
    <>
      <Drawer
        open={orderId !== null}
        onClose={onClose}
        width="lg"
        title={featureStrings.orders.detailTitle}
        footer={
          data && (
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirm('cancel')}
                disabled={!canCancel}
              >
                Batalkan
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirm('retry')}
                disabled={!canRetry}
              >
                {strings.actions.retry}
              </Button>
              <Button variant="danger" onClick={() => setConfirm('refund')} disabled={!canRefund}>
                {strings.actions.refund}
              </Button>
            </>
          )
        }
      >
        <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
          {data && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] text-text">{data.id}</span>
                <StatusPill tone={orderStatusTone(data.status)} label={orderStatusLabel[data.status]} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label={featureStrings.orders.customer} value={data.customerId} mono />
                <Field label={featureStrings.orders.product} value={data.productId} mono />
                <Field label={featureStrings.orders.amount} value={formatRupiah(data.amount)} />
                <Field label={featureStrings.orders.created} value={formatDateTime(data.createdAt)} />
              </dl>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {featureStrings.orders.timeline}
                </h3>
                <OrderTimeline status={data.status} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {featureStrings.orders.linkedExecution}
                </h3>
                {data.executionId ? (
                  <Link
                    to={`/monitoring?execution=${data.executionId}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[13px] text-brand-accent hover:underline"
                  >
                    {data.executionId}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <p className="text-sm text-text-muted">{featureStrings.orders.noExecution}</p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {featureStrings.orders.payment}
                </h3>
                {data.payment ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Field
                      label={featureStrings.payments.method}
                      value={paymentMethodLabel[data.payment.method]}
                    />
                    <div>
                      <dt className="text-xs text-text-muted">{featureStrings.payments.status}</dt>
                      <dd className="mt-0.5">
                        <StatusPill
                          tone={paymentStatusTone(data.payment.status)}
                          label={paymentStatusLabel[data.payment.status]}
                        />
                      </dd>
                    </div>
                    <Field label={featureStrings.payments.amount} value={formatRupiah(data.payment.amount)} />
                    <Field
                      label={featureStrings.payments.fee}
                      value={data.payment.fee === null ? '-' : formatRupiah(data.payment.fee)}
                    />
                  </dl>
                ) : (
                  <p className="text-sm text-text-muted">{featureStrings.orders.noPayment}</p>
                )}
              </section>
            </div>
          )}
        </QueryBoundary>
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        destructive={confirm === 'refund' || confirm === 'cancel'}
        message={
          confirm === 'refund'
            ? featureStrings.orders.refundConfirm
            : confirm === 'cancel'
              ? featureStrings.orders.cancelConfirm
              : featureStrings.orders.retryConfirm
        }
        isLoading={retryOrder.isPending || refundOrder.isPending || cancelOrder.isPending}
        onConfirm={async () => {
          if (!orderId) return;
          if (confirm === 'retry') await retryOrder.mutateAsync(orderId);
          if (confirm === 'refund') await refundOrder.mutateAsync(orderId);
          if (confirm === 'cancel') await cancelOrder.mutateAsync(orderId);
          setConfirm(null);
        }}
      />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={mono ? 'mt-0.5 truncate font-mono text-[13px] text-text' : 'mt-0.5 text-text'}>
        {value}
      </dd>
    </div>
  );
}
