import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { StatusTone } from '@/lib/status-tokens';

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  label: string;
  /** Pulse the dot for live/in-progress states (e.g. RUNNING). */
  pulse?: boolean;
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
 * Domain status pill with a leading dot (DESIGN_SYSTEM.md §13.8).
 * Color comes from a status token via the caller-supplied `tone`
 * (map enum → tone with the helpers in lib/status-tokens.ts).
 */
export function StatusPill({ tone, label, pulse, className, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors tone-fg tone-bg',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full tone-dot', pulse && 'animate-pulse-dot')}
        aria-hidden
      />
      {label}
    </span>
  );
}
