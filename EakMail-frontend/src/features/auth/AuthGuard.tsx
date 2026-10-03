/**
 * Route guard: gates the dashboard behind an authenticated admin session.
 *
 * Checks GET /api/auth/me. While checking → a lightweight loader. On 401 → redirect
 * to /login (remembering where the user was headed). On success → render the shell.
 * Backend auth (cookie session) already exists; this is the missing UI gate.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/useAuth';
import { ApiError } from '@/lib/api-error';
import { routes } from '@/app/routes';
import { strings } from '@/lib/strings';

export function AuthGuard() {
  const location = useLocation();
  const { data: user, isLoading, error } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-bg text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="text-sm">{strings.auth.checking}</span>
      </div>
    );
  }

  // Not authenticated (401) or no user → send to login, preserving the target.
  const unauthorized = error instanceof ApiError && error.isUnauthorized;
  if (unauthorized || !user) {
    return <Navigate to={routes.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
