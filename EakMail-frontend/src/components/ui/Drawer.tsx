import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Side the drawer docks to (right by default). */
  side?: 'right' | 'left';
  width?: 'sm' | 'md' | 'lg';
  className?: string;
}

const widthClass = {
  sm: 'w-full sm:w-80',
  md: 'w-full sm:w-[28rem]',
  lg: 'w-full sm:w-[36rem]',
} as const;

/**
 * Side panel / drawer for detail views and node config
 * (DESIGN_SYSTEM.md §5, §7.5). Accessible, portal-rendered, Escape-to-close.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  width = 'md',
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="animate-overlay-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'elevation-3 animate-slide-in-right absolute top-0 flex h-full flex-col border-border bg-surface outline-none',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          widthClass[width],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {description && <p className="text-sm text-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.actions.close}
            className="focus-ring -mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition hover:bg-surface-2 hover:text-text active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
