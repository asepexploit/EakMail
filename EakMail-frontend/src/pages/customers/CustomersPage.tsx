import { useState } from 'react';
import { Language } from '@eakmail/shared-types';
import { Card, Input, Select } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { languageLabel } from '@/features/shared/enum-labels';
import { useCustomers, useCustomerStats } from '@/features/customers/api/useCustomers';
import { CustomerStatsCards } from '@/features/customers/components/CustomerStatsCards';
import { CustomersTable } from '@/features/customers/components/CustomersTable';

const copy = featureStrings.customers;

const languageOptions = [
  { value: '', label: copy.filters.language + ': ' + strings.common.all },
  ...Object.values(Language).map((language) => ({
    value: language,
    label: languageLabel[language],
  })),
];

const blockedOptions = [
  { value: '', label: copy.filters.blockedAll },
  { value: 'false', label: copy.filters.activeOnly },
  { value: 'true', label: copy.filters.blockedOnly },
];

/** Customers (Pelanggan) page — stats cards + filterable table (thin). */
export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [blocked, setBlocked] = useState('');

  const stats = useCustomerStats();
  const list = useCustomers({
    pageSize: 500,
    search: search.trim() || undefined,
    language: (language as Language) || undefined,
    blocked: blocked === '' ? undefined : blocked === 'true',
  });

  return (
    <div className="space-y-5">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <QueryBoundary
        isLoading={stats.isLoading}
        isError={stats.isError}
        error={stats.error}
        onRetry={stats.refetch}
      >
        {stats.data && <CustomerStatsCards stats={stats.data} />}
      </QueryBoundary>

      <Card noPadding>
        <div className="flex flex-wrap items-end gap-3 px-3 py-3">
          <div className="min-w-[220px] flex-1">
            <Input
              label={strings.actions.search}
              placeholder={copy.filters.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              label={copy.filters.language}
              options={languageOptions}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              label={copy.filters.blocked}
              options={blockedOptions}
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <QueryBoundary
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
      >
        <CustomersTable customers={list.data?.items ?? []} />
      </QueryBoundary>
    </div>
  );
}
