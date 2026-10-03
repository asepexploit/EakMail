import { cn } from '@/lib/cn';
import type { StatusTone } from '@/lib/status-tokens';

export type HealthLevel = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface HealthDotProps {
  level: HealthLevel;
  label?: string;
  pulse?: boolean;
}

const levelTone: Record<HealthLevel, StatusTone> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  unknown: 'neutral',
};

const toneClass: Record<StatusTone, string> = {
  success: 'tone-success',
  running: 'tone-running',
  warning: 'tone-warning',
  danger: 'tone-danger',
  neutral: 'tone-neutral',
  info: 'tone-info',
};

/** Aggregate health indicator dot (DESIGN_SYSTEM.md §13.4). */
export function HealthDot({ level, label, pulse }: HealthDotProps) {
  const tone = levelTone[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5', toneClass[tone])} title={label}>
      <span
        className={cn('h-2 w-2 rounded-full tone-dot', pulse && 'animate-pulse')}
        aria-hidden
      />
      {label && <span className="text-xs text-text-muted">{label}</span>}
    </span>
  );
}
