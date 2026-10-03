import { forwardRef, useId, useState, type ReactNode } from 'react';
import { Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import { Badge } from './Badge';

export interface SecretFieldProps {
  label?: ReactNode;
  error?: string;
  helperText?: ReactNode;
  /** Whether a value is already stored server-side (never the value itself). */
  isSet?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Write-only secret input (DESIGN_SYSTEM.md §5, ARCHITECTURE.md §10).
 * Never renders the stored secret — only lets the admin *set* a new value.
 * The visibility toggle reveals only what the admin is currently typing.
 */
export const SecretField = forwardRef<HTMLInputElement, SecretFieldProps>(
  (
    {
      label,
      error,
      helperText,
      isSet = false,
      value,
      onValueChange,
      placeholder,
      name,
      disabled,
      className,
    },
    ref,
  ) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const fieldId = useId();
    const describedBy = error
      ? `${fieldId}-error`
      : helperText
        ? `${fieldId}-helper`
        : `${fieldId}-hint`;

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={fieldId} className="text-xs font-medium text-text-muted">
              {label}
            </label>
          )}
          {isSet ? (
            <Badge tone="success">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {strings.secret.storedBadge}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              {strings.secret.notSetBadge}
            </Badge>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={fieldId}
            name={name}
            type={isRevealed ? 'text' : 'password'}
            autoComplete="off"
            disabled={disabled}
            value={value ?? ''}
            onChange={(event) => onValueChange?.(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            placeholder={placeholder ?? strings.secret.placeholderSet}
            className={cn(
              'focus-ring h-10 w-full rounded-sm border bg-surface pl-3 pr-10 font-mono text-[13px] text-text transition',
              'placeholder:text-text-muted/70 disabled:opacity-60',
              error ? 'border-danger' : 'border-border',
            )}
          />
          <button
            type="button"
            onClick={() => setIsRevealed((prev) => !prev)}
            aria-label={isRevealed ? strings.secret.hide : strings.secret.show}
            className="focus-ring absolute right-2 flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:text-text"
          >
            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p id={`${fieldId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${fieldId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : (
          <p id={`${fieldId}-hint`} className="text-xs text-text-muted">
            {strings.secret.replaceHint}
          </p>
        )}
      </div>
    );
  },
);
SecretField.displayName = 'SecretField';
