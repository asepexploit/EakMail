import { Ban, ShoppingBag, Languages, Users } from 'lucide-react';
import type { CustomerStatsDto, Language } from '@eakmail/shared-types';
import { StatCard } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { featureStrings } from '@/features/shared/feature-strings';
import { languageLabel } from '@/features/shared/enum-labels';

export interface CustomerStatsCardsProps {
  stats: CustomerStatsDto;
}

/** Returns the language with the highest customer count, or null when none. */
function topLanguage(byLanguage: CustomerStatsDto['byLanguage']): Language | null {
  const entries = Object.entries(byLanguage) as [Language, number][];
  let best: [Language, number] | null = null;
  for (const entry of entries) {
    if (entry[1] > 0 && (best === null || entry[1] > best[1])) best = entry;
  }
  return best?.[0] ?? null;
}

/** KPI row for the Customers page (total / blocked / with-orders / top language). */
export function CustomerStatsCards({ stats }: CustomerStatsCardsProps) {
  const copy = featureStrings.customers.stats;
  const primaryLanguage = topLanguage(stats.byLanguage);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label={copy.total}
        value={formatNumber(stats.totalCustomers)}
        icon={<Users className="h-4 w-4" />}
      />
      <StatCard
        label={copy.withOrders}
        value={formatNumber(stats.withOrders)}
        icon={<ShoppingBag className="h-4 w-4" />}
      />
      <StatCard
        label={copy.blocked}
        value={formatNumber(stats.blockedCustomers)}
        icon={<Ban className="h-4 w-4" />}
      />
      <StatCard
        label={copy.topLanguage}
        value={primaryLanguage ? languageLabel[primaryLanguage] : '-'}
        icon={<Languages className="h-4 w-4" />}
      />
    </div>
  );
}
