import { useMemo } from 'react';
import {
  AccountStatus,
  ExecutionState,
  OrderStatus,
  type ExecutionDto,
  type OrderDto,
} from '@eakmail/shared-types';
import { useOrders } from '@/features/orders/api/useOrders';
import { useExecutions } from '@/features/monitoring/api/useExecutions';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useCustomerStats } from '@/features/customers/api/useCustomers';

/**
 * Overview data bag — aggregated KPIs from existing resource queries.
 * All aggregation is display-only; no business rules live here.
 */
export interface TopProduct {
  name: string;
  count: number;
  revenue: number;
}

export interface OverviewData {
  // Stat cards
  ordersToday: number;
  ordersYesterday: number;
  successRatePercent: number;
  revenueToday: number;
  revenueYesterday: number;
  revenueTotal: number;
  pendingCount: number;
  totalOrders: number;
  activeExecutions: number;
  healthyAccounts: number;
  totalAccounts: number;
  totalCustomers: number;
  // Lists
  recentOrders: OrderDto[];
  liveExecutions: ExecutionDto[];
  recentFailures: OrderDto[];
  topProducts: TopProduct[];
  // Charts
  ordersOverTime: Array<{ date: string; count: number; revenue: number }>;
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
}

const TERMINAL_SUCCESS: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.PAID];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function useOverview() {
  const ordersQuery = useOrders({ pageSize: 200 });
  const executionsQuery = useExecutions({ state: ExecutionState.RUNNING, pageSize: 50 });
  const accountsQuery = useAccounts();
  const customerStatsQuery = useCustomerStats();

  const isLoading =
    ordersQuery.isLoading || executionsQuery.isLoading || accountsQuery.isLoading;
  const isError = ordersQuery.isError || executionsQuery.isError || accountsQuery.isError;

  const data = useMemo<OverviewData | null>(() => {
    if (!ordersQuery.data || !executionsQuery.data || !accountsQuery.data) return null;

    const orders = ordersQuery.data.items;
    const executions = executionsQuery.data.items;
    const accounts = accountsQuery.data;

    const todaysOrders = orders.filter((o) => isToday(o.createdAt));
    const yesterdaysOrders = orders.filter((o) => isYesterday(o.createdAt));

    const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;
    const finished = orders.filter(
      (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.FAILED,
    ).length;
    const successRatePercent = finished === 0 ? 0 : (delivered / finished) * 100;

    const revenueToday = todaysOrders
      .filter((o) => TERMINAL_SUCCESS.includes(o.status))
      .reduce((sum, o) => sum + o.amount, 0);

    const revenueYesterday = yesterdaysOrders
      .filter((o) => TERMINAL_SUCCESS.includes(o.status))
      .reduce((sum, o) => sum + o.amount, 0);

    const revenueTotal = orders
      .filter((o) => TERMINAL_SUCCESS.includes(o.status))
      .reduce((sum, o) => sum + o.amount, 0);

    const pendingCount = orders.filter((o) => o.status === OrderStatus.PENDING).length;

    // Orders over time (last 30 days with revenue)
    const byDay = new Map<string, { count: number; revenue: number }>();
    for (const order of orders) {
      const key = dayKey(order.createdAt);
      const prev = byDay.get(key) ?? { count: 0, revenue: 0 };
      byDay.set(key, {
        count: prev.count + 1,
        revenue: TERMINAL_SUCCESS.includes(order.status) ? prev.revenue + order.amount : prev.revenue,
      });
    }
    const ordersOverTime = [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // Status distribution
    const byStatus = new Map<OrderStatus, number>();
    for (const order of orders) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    }
    const statusDistribution = [...byStatus.entries()].map(([status, count]) => ({ status, count }));

    // Top products (by delivered order count)
    const productMap = new Map<string, { count: number; revenue: number }>();
    for (const order of orders) {
      if (TERMINAL_SUCCESS.includes(order.status)) {
        const prev = productMap.get(order.productName) ?? { count: 0, revenue: 0 };
        productMap.set(order.productName, {
          count: prev.count + order.quantity,
          revenue: prev.revenue + order.amount,
        });
      }
    }
    const topProducts = [...productMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      ordersToday: todaysOrders.length,
      ordersYesterday: yesterdaysOrders.length,
      successRatePercent,
      revenueToday,
      revenueYesterday,
      revenueTotal,
      pendingCount,
      totalOrders: orders.length,
      activeExecutions: executionsQuery.data.total,
      healthyAccounts: accounts.filter((a) => a.status === AccountStatus.CONNECTED).length,
      totalAccounts: accounts.length,
      totalCustomers: customerStatsQuery.data?.totalCustomers ?? 0,
      recentOrders: orders.slice(0, 10),
      liveExecutions: executions.slice(0, 8),
      recentFailures: orders.filter((o) => o.status === OrderStatus.FAILED).slice(0, 8),
      topProducts,
      ordersOverTime,
      statusDistribution,
    };
  }, [ordersQuery.data, executionsQuery.data, accountsQuery.data, customerStatsQuery.data]);

  return {
    data,
    isLoading,
    isError,
    refetch: () => {
      void ordersQuery.refetch();
      void executionsQuery.refetch();
      void accountsQuery.refetch();
      void customerStatsQuery.refetch();
    },
  };
}
