import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  helperText?: ReactNode;
  /** Adornment rendered at the start of the field (e.g. a search icon). */
  startAdornment?: ReactNode;
  /** Whether the value is data/code and should render in the mono font. */
  mono?: boolean;
}

/** Labelled text input with error + helper text (DESIGN_SYSTEM.md §5, §13.7). */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, startAdornment, mono, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-text-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startAdornment && (
            <span className="pointer-events-none absolute left-3 flex items-center text-text-muted">
              {startAdornment}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'focus-ring h-10 w-full rounded-sm border bg-surface px-3 text-sm text-text',
              'placeholder:text-text-muted/70 transition',
              startAdornment && 'pl-9',
              mono && 'font-mono text-[13px]',
              error ? 'border-danger' : 'border-border',
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
