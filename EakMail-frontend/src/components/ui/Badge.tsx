import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { StatusTone } from '@/lib/status-tokens';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  /** Neutral outline style instead of a tinted fill. */
  variant?: 'soft' | 'outline';
}

const toneClass: Record<StatusTone, string> = {
  success: 'tone-success',
  running: 'tone-running',
  warning: 'tone-warning',
  danger: 'tone-danger',
  neutral: 'tone-neutral',
  info: 'tone-info',
};

/**
 * Small tinted label colored by a status token (DESIGN_SYSTEM.md §3.2, §13.8).
 * For domain state with a leading dot, prefer StatusPill.
 */
export function Badge({ tone = 'neutral', variant = 'soft', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors tone-fg',
        toneClass[tone],
        variant === 'soft' ? 'tone-bg' : 'border tone-border',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
