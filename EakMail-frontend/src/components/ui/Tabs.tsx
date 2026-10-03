import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Controlled tab list (DESIGN_SYSTEM.md §5). Accessible roving tablist;
 * the caller renders the active panel. Left/Right arrows move focus.
 */
export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  const baseId = useId();

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const count = tabs.length;
    for (let step = 1; step <= count; step += 1) {
      const nextIndex = (index + direction * step + count) % count;
      const next = tabs[nextIndex];
      if (!next.disabled) {
        onChange(next.value);
        document.getElementById(`${baseId}-tab-${next.value}`)?.focus();
        break;
      }
    }
  }

  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 border-b border-border', className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${baseId}-tab-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isActive
                ? 'border-brand text-text'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
