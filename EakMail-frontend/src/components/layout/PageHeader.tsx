import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode;
}

/** Standard page header: title + optional description + actions (DESIGN_SYSTEM.md §2.1). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
