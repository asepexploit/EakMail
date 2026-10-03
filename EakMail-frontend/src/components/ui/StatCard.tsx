import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Signed delta percentage; positive is success, negative is danger. */
  delta?: number;
  /** Formatted delta text; when omitted the delta number is shown with a sign. */
  deltaLabel?: string;
  icon?: ReactNode;
  /** Optional sparkline / mini chart slot (rendered below the value). */
  chart?: ReactNode;
  className?: string;
}

/** KPI tile with label, value and delta pill (DESIGN_SYSTEM.md §7.1, §13.5). */
export function StatCard({ label, value, delta, deltaLabel, icon, chart, className }: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isPositive = hasDelta && delta! >= 0;

  return (
    <div
      className={cn(
        'elevation-1 rounded-md border border-border bg-surface p-4 transition hover:[box-shadow:var(--shadow-2)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums text-text">{value}</span>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tone-fg tone-bg',
              isPositive ? 'tone-success' : 'tone-danger',
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3 w-3" aria-hidden />
            )}
            {deltaLabel ?? `${isPositive ? '+' : ''}${delta!.toFixed(1)}%`}
          </span>
        )}
      </div>
      {chart && <div className="mt-3 h-10">{chart}</div>}
    </div>
  );
}
