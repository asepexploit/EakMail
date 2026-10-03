import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, ListOrdered, Package,
  RefreshCw, ServerCog, TrendingUp, Users, Wallet, XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { strings } from '@/lib/strings';
import { formatDateTime, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { executionStateTone, orderStatusTone } from '@/lib/status-tokens';
import { executionStateLabel, orderStatusLabel } from '@/features/shared/enum-labels';
import { featureStrings } from '@/features/shared/feature-strings';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { useOverview } from '@/features/overview/api/useOverview';
import { OrdersOverTimeChart } from '@/features/overview/components/OrdersOverTimeChart';
import { StatusDistributionChart } from '@/features/overview/components/StatusDistributionChart';

/** Signed delta % between two numbers. */
function calcDelta(today: number, yesterday: number): number | undefined {
  if (yesterday === 0) return today > 0 ? 100 : undefined;
  return ((today - yesterday) / yesterday) * 100;
}

/** Overview (Ringkasan) — dashboard home. */
export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Ringkasan</h1>
          <p className="text-sm text-text-muted mt-0.5">{featureStrings.overview.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Muat Ulang
        </Button>
      </div>

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        {data && (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                label={featureStrings.overview.ordersToday}
                value={formatNumber(data.ordersToday)}
                delta={calcDelta(data.ordersToday, data.ordersYesterday)}
                deltaLabel={
                  data.ordersYesterday > 0
                    ? `${data.ordersYesterday} kemarin`
                    : undefined
                }
                icon={<ListOrdered className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.revenue}
                value={formatRupiah(data.revenueToday)}
                delta={calcDelta(data.revenueToday, data.revenueYesterday)}
                icon={<Wallet className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.successRate}
                value={formatPercent(data.successRatePercent)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.pendingOrders}
                value={formatNumber(data.pendingCount)}
                icon={<Clock className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.totalOrders}
                value={formatNumber(data.totalOrders)}
                icon={<Package className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.revenueTotal}
                value={formatRupiah(data.revenueTotal)}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.totalCustomers}
                value={formatNumber(data.totalCustomers)}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label={featureStrings.overview.healthyAccounts}
                value={`${data.healthyAccounts}/${data.totalAccounts}`}
                icon={<ServerCog className="h-4 w-4" />}
                delta={data.totalAccounts > 0
                  ? (data.healthyAccounts / data.totalAccounts) * 100 - 100
                  : undefined}
              />
            </div>

            {/* ── Charts ── */}
            <div className="grid gap-4 xl:grid-cols-3">
              <Card title={featureStrings.overview.ordersOverTime} className="xl:col-span-2">
                <OrdersOverTimeChart data={data.ordersOverTime} />
              </Card>
              <Card title={featureStrings.overview.statusDistribution}>
                <StatusDistributionChart data={data.statusDistribution} />
              </Card>
            </div>

            {/* ── Bottom row ── */}
            <div className="grid gap-4 xl:grid-cols-3">
              {/* Recent orders — 2/3 width */}
              <Card
                title={featureStrings.overview.recentOrders}
                className="xl:col-span-2"
                actions={
                  <Link to="/orders" className="text-xs text-brand-accent hover:underline">
                    {strings.actions.view}
                  </Link>
                }
              >
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-1">Produk</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-1">Waktu</th>
                        <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted px-1">Jumlah</th>
                        <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wide text-text-muted px-1">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {data.recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-text-muted">
                            {strings.common.empty}
                          </td>
                        </tr>
                      )}
                      {data.recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="py-2.5 px-1">
                            <p className="text-sm font-medium text-text truncate max-w-[180px]">{order.productName}</p>
                            <p className="text-[11px] text-text-muted font-mono">{order.id.slice(0, 14)}…</p>
                          </td>
                          <td className="py-2.5 px-1 text-xs text-text-muted whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                          <td className="py-2.5 px-1 text-right text-sm tabular-nums text-text whitespace-nowrap">{formatRupiah(order.amount)}</td>
                          <td className="py-2.5 px-1 text-right">
                            <StatusPill
                              tone={orderStatusTone(order.status)}
                              label={orderStatusLabel[order.status]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Right column */}
              <div className="space-y-4">
                {/* Top products */}
                <Card title={featureStrings.overview.topProducts}>
                  {data.topProducts.length === 0 ? (
                    <p className="py-4 text-center text-sm text-text-muted">Belum ada data</p>
                  ) : (
                    <ol className="space-y-2">
                      {data.topProducts.map((p, i) => (
                        <li key={p.name} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-text">{p.name}</p>
                            <p className="text-[11px] text-text-muted">{formatRupiah(p.revenue)}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                            {formatNumber(p.count)} terjual
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>

                {/* Live executions */}
                <Card
                  title={featureStrings.overview.liveExecutions}
                  actions={
                    <Link to="/monitoring" className="text-xs text-brand-accent hover:underline">
                      {strings.actions.view}
                    </Link>
                  }
                >
                  {data.liveExecutions.length === 0 ? (
                    <p className="py-3 text-center text-sm text-text-muted">{strings.common.empty}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.liveExecutions.map((execution) => (
                        <li key={execution.id} className="flex items-center justify-between gap-2 text-sm">
                          <Link
                            to={`/monitoring?execution=${execution.id}`}
                            className="truncate font-mono text-[12px] text-text hover:text-brand-accent"
                          >
                            {execution.id.slice(0, 16)}…
                          </Link>
                          <StatusPill
                            tone={executionStateTone(execution.state)}
                            label={executionStateLabel[execution.state]}
                            pulse={execution.state === 'RUNNING'}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/* Recent failures */}
                <Card
                  title={featureStrings.overview.recentFailures}
                  actions={
                    data.recentFailures.length > 0 ? (
                      <Link to="/orders?status=FAILED" className="text-xs text-danger hover:underline">
                        {strings.actions.view}
                      </Link>
                    ) : undefined
                  }
                >
                  {data.recentFailures.length === 0 ? (
                    <div className="flex flex-col items-center py-3 gap-1">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <p className="text-sm text-text-muted">Tidak ada kegagalan</p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.recentFailures.map((order) => (
                        <li key={order.id} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs text-text">{order.productName}</p>
                            <p className="font-mono text-[10px] text-text-muted">{order.id.slice(0, 14)}…</p>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-text-muted">{formatRupiah(order.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
