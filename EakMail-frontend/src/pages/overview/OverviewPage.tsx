import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, ListOrdered, ServerCog, Users, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { strings } from '@/lib/strings';
import { formatDateTime, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { executionStateTone, orderStatusTone } from '@/lib/status-tokens';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { executionStateLabel, orderStatusLabel } from '@/features/shared/enum-labels';
import { featureStrings } from '@/features/shared/feature-strings';
import { useOverview } from '@/features/overview/api/useOverview';
import { OrdersOverTimeChart } from '@/features/overview/components/OrdersOverTimeChart';
import { StatusDistributionChart } from '@/features/overview/components/StatusDistributionChart';

/** Overview (Ringkasan) — dashboard home (DESIGN_SYSTEM.md §7.1, §13.11). */
export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.overview} description={featureStrings.overview.subtitle} />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard
                label={featureStrings.overview.ordersToday}
                value={formatNumber(data.ordersToday)}
                icon={<ListOrdered className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.successRate}
                value={formatPercent(data.successRatePercent)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.revenue}
                value={formatRupiah(data.revenueToday)}
                icon={<Wallet className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.activeExecutions}
                value={formatNumber(data.activeExecutions)}
                icon={<Activity className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.healthyAccounts}
                value={`${formatNumber(data.healthyAccounts)}/${formatNumber(data.totalAccounts)}`}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.queueDepth}
                value={formatNumber(data.liveExecutions.length)}
                icon={<ServerCog className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card title={featureStrings.overview.ordersOverTime} className="xl:col-span-2">
                <OrdersOverTimeChart data={data.ordersOverTime} />
              </Card>
              <Card title={featureStrings.overview.statusDistribution}>
                <StatusDistributionChart data={data.statusDistribution} />
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card
                title={featureStrings.overview.recentOrders}
                className="xl:col-span-2"
                actions={
                  <Link to="/orders" className="text-xs text-brand-accent hover:underline">
                    {strings.actions.view}
                  </Link>
                }
              >
                <ul className="divide-y divide-border/60">
                  {data.recentOrders.length === 0 && (
                    <li className="py-6 text-center text-sm text-text-muted">
                      {strings.common.empty}
                    </li>
                  )}
                  {data.recentOrders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[13px] text-text">{order.id}</p>
                        <p className="text-xs text-text-muted">{formatDateTime(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-sm text-text">
                          {formatRupiah(order.amount)}
                        </span>
                        <StatusPill
                          tone={orderStatusTone(order.status)}
                          label={orderStatusLabel[order.status]}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="space-y-4">
                <Card
                  title={featureStrings.overview.liveExecutions}
                  actions={
                    <Link to="/monitoring" className="text-xs text-brand-accent hover:underline">
                      {strings.actions.view}
                    </Link>
                  }
                >
                  <ul className="space-y-2">
                    {data.liveExecutions.length === 0 && (
                      <li className="py-4 text-center text-sm text-text-muted">
                        {strings.common.empty}
                      </li>
                    )}
                    {data.liveExecutions.map((execution) => (
                      <li
                        key={execution.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <Link
                          to={`/monitoring?execution=${execution.id}`}
                          className="truncate font-mono text-[13px] text-text hover:text-brand-accent"
                        >
                          {execution.id}
                        </Link>
                        <StatusPill
                          tone={executionStateTone(execution.state)}
                          label={executionStateLabel[execution.state]}
                          pulse={execution.state === 'RUNNING'}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title={featureStrings.overview.recentFailures}>
                  <ul className="space-y-2">
                    {data.recentFailures.length === 0 && (
                      <li className="py-4 text-center text-sm text-text-muted">
                        {strings.common.none}
                      </li>
                    )}
                    {data.recentFailures.map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link
                          to={`/orders?order=${order.id}`}
                          className="truncate font-mono text-[13px] text-text hover:text-brand-accent"
                        >
                          {order.id}
                        </Link>
                        <StatusPill
                          tone={orderStatusTone(order.status)}
                          label={orderStatusLabel[order.status]}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
