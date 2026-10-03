import { OrderStatus, type OrderStatus as OrderStatusType } from '@eakmail/shared-types';
import { cn } from '@/lib/cn';
import { orderStatusTone } from '@/lib/status-tokens';
import { orderStatusLabel } from '@/features/shared/enum-labels';

const toneVar: Record<string, string> = {
  success: 'var(--success)',
  running: 'var(--running)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--neutral)',
  info: 'var(--info)',
};

/**
 * Per-status step chains that reflect the actual state machine (BLUEPRINT.md §5.2).
 * EXPIRED always comes from PENDING (never from PAID), so it must NOT include PAID.
 * FAILED always comes from FULFILLING.
 */
const CHAINS: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatus.PENDING]:        [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.DELIVERED],
  [OrderStatus.PAID]:           [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.DELIVERED],
  [OrderStatus.FULFILLING]:     [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]:      [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.DELIVERED],
  [OrderStatus.EXPIRED]:        [OrderStatus.PENDING, OrderStatus.EXPIRED],
  [OrderStatus.FAILED]:         [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.FAILED],
  [OrderStatus.REFUND_PENDING]: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.FAILED, OrderStatus.REFUND_PENDING],
  [OrderStatus.REFUNDED]:       [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.FAILED, OrderStatus.REFUNDED],
};

export interface OrderTimelineProps {
  status: OrderStatusType;
}

/** Order state-machine timeline (DESIGN_SYSTEM.md §7.5). Read-only view of backend state. */
export function OrderTimeline({ status }: OrderTimelineProps) {
  const steps = CHAINS[status] ?? CHAINS[OrderStatus.PENDING];
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const color = reached ? toneVar[orderStatusTone(step)] : 'var(--neutral)';
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn('h-3 w-3 shrink-0 rounded-full', !reached && 'opacity-30')}
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className={cn('text-sm', reached ? 'text-text' : 'text-text-muted', isCurrent && 'font-medium')}>
              {orderStatusLabel[step]}
            </span>
            {isCurrent && (
              <span className="ml-auto text-[10px] text-text-muted">← sekarang</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
