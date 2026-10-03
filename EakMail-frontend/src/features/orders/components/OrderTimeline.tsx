import { OrderStatus, type OrderStatus as OrderStatusType } from '@eakmail/shared-types';
import { cn } from '@/lib/cn';
import { orderStatusTone } from '@/lib/status-tokens';
import { orderStatusLabel } from '@/features/shared/enum-labels';

/** Canonical happy-path order lifecycle (BLUEPRINT.md §5.2) for the timeline display. */
const HAPPY_PATH: OrderStatusType[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.FULFILLING,
  OrderStatus.DELIVERED,
];

const toneVar: Record<string, string> = {
  success: 'var(--success)',
  running: 'var(--running)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--neutral)',
  info: 'var(--info)',
};

export interface OrderTimelineProps {
  status: OrderStatusType;
}

/** Order state-machine timeline (DESIGN_SYSTEM.md §7.5). Read-only view of backend state. */
export function OrderTimeline({ status }: OrderTimelineProps) {
  // For off-path terminal states (FAILED/REFUNDED/EXPIRED) show them as the final marker.
  const isOffPath = !HAPPY_PATH.includes(status);
  const steps = isOffPath ? [...HAPPY_PATH.slice(0, 2), status] : HAPPY_PATH;
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const reached = index <= currentIndex;
        const color = reached ? toneVar[orderStatusTone(step)] : 'var(--neutral)';
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn('h-3 w-3 shrink-0 rounded-full', !reached && 'opacity-40')}
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className={cn('text-sm', reached ? 'text-text' : 'text-text-muted')}>
              {orderStatusLabel[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
