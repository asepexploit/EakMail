import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Max width preset for the panel. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * Lightweight accessible modal dialog (DESIGN_SYSTEM.md §5, §13.7).
 * Renders in a portal, traps Escape, restores focus, and locks body scroll.
 * No external dependency — a focused, accessible implementation.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the panel once when dialog opens.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]); // onClose via ref — intentionally excluded to avoid re-focusing on every render

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-overlay-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'elevation-3 animate-fade-in relative z-10 w-full rounded-md border border-border bg-surface outline-none',
          sizeClass[size],
          className,
        )}
      >
        {(title || description) && (
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
        )}
        {children && <div className="px-5 py-4">{children}</div>}
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
