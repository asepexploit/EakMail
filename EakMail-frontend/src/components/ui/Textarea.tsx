import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  helperText?: ReactNode;
  /** Render content in the mono font (for payloads, templates, code). */
  mono?: boolean;
}

/** Labelled multi-line input with error + helper text (DESIGN_SYSTEM.md §5). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, mono, className, id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const describedBy = error ? `${fieldId}-error` : helperText ? `${fieldId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={fieldId} className="text-xs font-medium text-text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'focus-ring w-full rounded-sm border bg-surface px-3 py-2 text-sm text-text',
            'placeholder:text-text-muted/70 transition',
            mono && 'font-mono text-[13px]',
            error ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${fieldId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${fieldId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
