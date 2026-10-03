import { useEffect, useRef, type ReactNode } from 'react';
import { strings } from '@/lib/strings';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive/irreversible actions (default true). */
  destructive?: boolean;
  isLoading?: boolean;
}

/**
 * Confirmation dialog for destructive actions (DESIGN_SYSTEM.md §5, §13.7).
 * Danger-styled by default; used for delete/refund/cancel flows.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  isLoading,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Autofocus the confirm button so Enter triggers it immediately.
  useEffect(() => {
    if (open) {
      // Defer to let the Dialog mount + run its focus-into-panel effect first.
      const id = window.setTimeout(() => confirmRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Global Enter handler while this dialog is open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        onConfirm();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isLoading, onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title ?? strings.confirm.title}
      description={message ?? strings.confirm.message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel ?? strings.confirm.cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel ?? strings.confirm.confirmLabel}
          </Button>
        </>
      }
    />
  );
}
