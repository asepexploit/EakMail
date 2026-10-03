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

/**
 * The Overview (Ringkasan) view composes existing resource queries into the KPI +
 * chart data the dashboard home shows (DESIGN_SYSTEM.md §7.1). This is display-only
 * aggregation over data the backend already decided — no business rules live here.
 */
export interface OverviewData {
  ordersToday: number;
  successRatePercent: number;
  revenueToday: number;
  activeExecutions: number;
  healthyAccounts: number;
  totalAccounts: number;
  recentOrders: OrderDto[];
  liveExecutions: ExecutionDto[];
  recentFailures: OrderDto[];
  ordersOverTime: Array<{ date: string; count: number }>;
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
}

const TERMINAL_SUCCESS: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.PAID];

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function useOverview() {
  const ordersQuery = useOrders({ pageSize: 200 });
  const executionsQuery = useExecutions({ state: ExecutionState.RUNNING, pageSize: 50 });
  const accountsQuery = useAccounts();

  const isLoading =
    ordersQuery.isLoading || executionsQuery.isLoading || accountsQuery.isLoading;
  const isError = ordersQuery.isError || executionsQuery.isError || accountsQuery.isError;

  const data = useMemo<OverviewData | null>(() => {
    if (!ordersQuery.data || !executionsQuery.data || !accountsQuery.data) return null;

    const orders = ordersQuery.data.items;
    const executions = executionsQuery.data.items;
    const accounts = accountsQuery.data;

    const todaysOrders = orders.filter((o) => isToday(o.createdAt));
    const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED).length;
    const finished = orders.filter(
      (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.FAILED,
    ).length;
    const successRatePercent = finished === 0 ? 0 : (delivered / finished) * 100;

    const revenueToday = todaysOrders
      .filter((o) => TERMINAL_SUCCESS.includes(o.status))
      .reduce((sum, o) => sum + o.amount, 0);

    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = dayKey(order.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const ordersOverTime = [...byDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const byStatus = new Map<OrderStatus, number>();
    for (const order of orders) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    }
    const statusDistribution = [...byStatus.entries()].map(([status, count]) => ({
      status,
      count,
    }));

    return {
      ordersToday: todaysOrders.length,
      successRatePercent,
      revenueToday,
      activeExecutions: executionsQuery.data.total,
      healthyAccounts: accounts.filter((a) => a.status === AccountStatus.CONNECTED).length,
      totalAccounts: accounts.length,
      recentOrders: orders.slice(0, 8),
      liveExecutions: executions.slice(0, 8),
      recentFailures: orders.filter((o) => o.status === OrderStatus.FAILED).slice(0, 8),
      ordersOverTime,
      statusDistribution,
    };
  }, [ordersQuery.data, executionsQuery.data, accountsQuery.data]);

  return {
    data,
    isLoading,
    isError,
    refetch: () => {
      void ordersQuery.refetch();
      void executionsQuery.refetch();
      void accountsQuery.refetch();
    },
  };
}
