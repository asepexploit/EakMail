import { Construction } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';

export interface PlaceholderPageProps {
  /** Localized page title (from the strings module). */
  title: string;
}

/**
 * Placeholder route content shown until a feature agent wires the real page.
 * Keeps every route mountable through the shell without inventing page logic.
 */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="h-10 w-10 text-text-muted" aria-hidden />
          <p className="text-base font-medium text-text">{strings.placeholder.title}</p>
          <p className="max-w-md text-sm text-text-muted">{strings.placeholder.body}</p>
        </div>
      </Card>
    </>
  );
}
