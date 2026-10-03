import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { OrderStatus } from '@eakmail/shared-types';
import { formatNumber } from '@/lib/format';
import { orderStatusTone } from '@/lib/status-tokens';
import { orderStatusLabel } from '@/features/shared/enum-labels';

export interface StatusDistributionChartProps {
  data: Array<{ status: OrderStatus; count: number }>;
}

/** Maps a status tone to its CSS variable so the donut matches status pills. */
const toneVar: Record<string, string> = {
  success: 'var(--success)',
  running: 'var(--running)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--neutral)',
  info: 'var(--info)',
};

/** Order-status distribution donut (DESIGN_SYSTEM.md §13.9). */
export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const chartData = data.map((entry) => ({
    ...entry,
    label: orderStatusLabel[entry.status],
    color: toneVar[orderStatusTone(entry.status)] ?? 'var(--neutral)',
  }));

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text)',
            }}
            formatter={(value: number, _name, item) => [
              formatNumber(value),
              (item?.payload as { label?: string })?.label ?? '',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-xs">
        {chartData.map((entry) => (
          <li key={entry.status} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.label}
            </span>
            <span className="tabular-nums text-text">{formatNumber(entry.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
