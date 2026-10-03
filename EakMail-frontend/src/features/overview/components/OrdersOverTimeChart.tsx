import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatNumber } from '@/lib/format';
import { featureStrings } from '@/features/shared/feature-strings';

export interface OrdersOverTimeChartProps {
  data: Array<{ date: string; count: number }>;
}

/** Orders-over-time area chart (DESIGN_SYSTEM.md §13.9). Colors come from tokens. */
export function OrdersOverTimeChart({ data }: OrdersOverTimeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatDate(value)}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text)',
          }}
          labelFormatter={(value) => formatDate(String(value))}
          formatter={(value: number) => [
            formatNumber(value),
            featureStrings.overview.ordersSeriesLabel,
          ]}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--brand-accent)"
          strokeWidth={2}
          fill="url(#ordersFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
