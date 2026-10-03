import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { strings } from '@/lib/strings';
import { ApiError } from '@/lib/api-error';

export interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  children: ReactNode;
}

/** Renders loading / error states around a query's content in one consistent place. */
export function QueryBoundary({ isLoading, isError, error, onRetry, children }: QueryBoundaryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">{strings.common.loading}</span>
      </div>
    );
  }

  if (isError) {
    const message = error instanceof ApiError ? error.message : strings.common.error;
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-danger" aria-hidden />
        <p className="text-sm font-medium text-text">{strings.common.error}</p>
        <p className="max-w-md text-xs text-text-muted">{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {strings.actions.retry}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
