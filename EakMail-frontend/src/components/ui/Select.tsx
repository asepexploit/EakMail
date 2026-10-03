import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  helperText?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
}

/** Native select styled with tokens (DESIGN_SYSTEM.md §5). Accessible by default. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className, id, ...props }, ref) => {
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
        <div className="relative">
          <select
            ref={ref}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'focus-ring h-10 w-full appearance-none rounded-sm border bg-surface pl-3 pr-9 text-sm text-text transition',
              error ? 'border-danger' : 'border-border',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
        </div>
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
Select.displayName = 'Select';
