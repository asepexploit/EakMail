import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { routes } from '@/app/routes';
import { strings } from '@/lib/strings';

/** 404 fallback route. */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-mono text-4xl font-semibold text-text-muted">404</p>
      <p className="text-base font-medium text-text">{strings.placeholder.title}</p>
      <Link to={routes.overview}>
        <Button variant="secondary">{strings.nav.overview}</Button>
      </Link>
    </div>
  );
}
