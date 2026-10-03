import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import type { StatusTone } from '@/lib/status-tokens';
import { ToastContext, type ToastEntry, type ToastOptions } from './toast-context';

const toneClass: Record<StatusTone, string> = {
  success: 'tone-success',
  running: 'tone-running',
  warning: 'tone-warning',
  danger: 'tone-danger',
  neutral: 'tone-neutral',
  info: 'tone-info',
};

function ToastIcon({ tone }: { tone: StatusTone }) {
  const className = 'h-4 w-4 tone-fg';
  switch (tone) {
    case 'success':
      return <CheckCircle2 className={className} aria-hidden />;
    case 'danger':
      return <XCircle className={className} aria-hidden />;
    case 'warning':
      return <AlertTriangle className={className} aria-hidden />;
    default:
      return <Info className={className} aria-hidden />;
  }
}

/**
 * Toast provider + viewport (DESIGN_SYSTEM.md §5). Non-blocking notifications.
 * Wrap the app once; trigger via the `useToast` hook.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: ToastEntry = { id, tone: 'neutral', durationMs: 4000, ...options };
      setToasts((prev) => [...prev, entry]);
      if (entry.durationMs && entry.durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), entry.durationMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
          role="region"
          aria-label={strings.toast.saved}
        >
          {toasts.map((toast) => {
            const tone = toast.tone ?? 'neutral';
            return (
              <div
                key={toast.id}
                role="status"
                className={cn(
                  'elevation-3 animate-slide-in-right pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-surface px-4 py-3',
                  toneClass[tone],
                )}
              >
                <ToastIcon tone={tone} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-xs text-text-muted">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label={strings.actions.close}
                  className="focus-ring flex h-6 w-6 items-center justify-center rounded-sm text-text-muted transition hover:bg-surface-2 hover:text-text active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
