/**
 * Login page — the auth entry point for the dashboard (Bahasa Indonesia UI).
 * Posts to /api/auth/login (cookie session). On success, redirects to where the
 * user was headed (guard state) or the overview. Local-first branding.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCurrentUser, useLogin } from '@/features/auth/useAuth';
import { ApiError } from '@/lib/api-error';
import { routes } from '@/app/routes';
import { strings } from '@/lib/strings';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const { data: user } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const target = (location.state as LocationState | null)?.from ?? routes.overview;

  // Already authenticated → skip the form.
  if (user) return <Navigate to={target} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await login.mutateAsync({ email, password, totp: totp || undefined });
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setErrorMessage(strings.auth.invalid);
      } else {
        setErrorMessage(strings.auth.genericError);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-white">
            <Mail className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-text">{strings.auth.title}</h1>
          <p className="text-sm text-text-muted">{strings.auth.subtitle}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="elevation-2 flex flex-col gap-4 rounded-md border border-border bg-surface p-6"
        >
          <Input
            label={strings.auth.emailLabel}
            type="email"
            autoComplete="username"
            placeholder={strings.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            startAdornment={<Mail className="h-4 w-4" aria-hidden />}
            required
            autoFocus
          />
          <Input
            label={strings.auth.passwordLabel}
            type="password"
            autoComplete="current-password"
            placeholder={strings.auth.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label={strings.auth.totpLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={strings.auth.totpPlaceholder}
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            mono
          />

          {errorMessage && (
            <p className="tone-danger tone-fg text-sm" role="alert">
              {errorMessage}
            </p>
          )}

          <Button type="submit" isLoading={login.isPending} className="w-full">
            {login.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {strings.auth.submitting}
              </>
            ) : (
              strings.auth.submit
            )}
          </Button>

          <p className="text-center text-xs text-text-muted">{strings.auth.localOnly}</p>
        </form>
      </div>
    </div>
  );
}
