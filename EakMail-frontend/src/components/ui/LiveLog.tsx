import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import type { StatusTone } from '@/lib/status-tokens';
import { formatTime } from '@/lib/format';
import { Button } from './Button';

export interface LogLine {
  id: string;
  timestamp: Date | string | number;
  /** Left label, e.g. "exec#8421" or node type. */
  label?: string;
  message: string;
  /** Tone colors the status word / message (DESIGN_SYSTEM.md §9.3). */
  tone?: StatusTone;
  /** Right-aligned trailing text (e.g. timing "120ms"). */
  trailing?: string;
}

export interface LiveLogProps {
  lines: LogLine[];
  className?: string;
  height?: number;
  /** Show the auto-scroll pause/resume control. */
  showControls?: boolean;
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
 * Auto-scrolling, color-coded log stream (DESIGN_SYSTEM.md §9.2–9.3).
 * Presentational: the caller supplies lines (e.g. from the WS client) and this
 * renders + auto-scrolls with a pause toggle. Monospace per typography spec.
 */
export function LiveLog({ lines, className, height = 320, showControls = true }: LiveLogProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  return (
    <div className={cn('flex flex-col rounded-md border border-border bg-surface-2', className)}>
      {showControls && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-text-muted">
            {strings.table.rowCount(lines.length)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setAutoScroll((prev) => !prev)}>
            {autoScroll ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden />
                Auto-scroll
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden />
                Auto-scroll
              </>
            )}
          </Button>
        </div>
      )}
      <div
        ref={scrollRef}
        className="scroll-thin overflow-auto p-3 font-mono text-[13px] leading-relaxed"
        style={{ height }}
        role="log"
        aria-live={autoScroll ? 'polite' : 'off'}
      >
        {lines.length === 0 ? (
          <p className="text-text-muted">{strings.common.empty}</p>
        ) : (
          lines.map((line) => {
            const tone = line.tone ?? 'neutral';
            return (
              <div key={line.id} className="animate-fade-in flex items-baseline gap-2 whitespace-pre-wrap">
                <span className="shrink-0 text-text-muted">{formatTime(line.timestamp)}</span>
                {line.label && <span className="shrink-0 text-text">{line.label}</span>}
                <span className={cn('flex-1 tone-fg', toneClass[tone])}>{line.message}</span>
                {line.trailing && (
                  <span className="shrink-0 text-text-muted">{line.trailing}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
