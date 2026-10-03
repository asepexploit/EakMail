import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional header title rendered above the content. */
  title?: ReactNode;
  /** Optional actions rendered on the right of the header. */
  actions?: ReactNode;
  /** Remove inner padding (e.g. for a table that manages its own spacing). */
  noPadding?: boolean;
  /** Set true for cards that are clickable — enables hover elevation feedback. */
  interactive?: boolean;
}

/** Surface container with soft elevation (DESIGN_SYSTEM.md §13.5, §13.10). */
export function Card({
  title,
  actions,
  noPadding,
  interactive,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'elevation-1 rounded-md border border-border bg-surface transition',
        interactive && 'cursor-pointer hover:[box-shadow:var(--shadow-2)] active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-text">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </div>
  );
}
