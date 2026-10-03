import type { BroadcastDto } from '@eakmail/shared-types';
import { BroadcastStatus } from '@eakmail/shared-types';
import { Card, DataTable, StatusPill, type Column } from '@/components/ui';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { broadcastStatusLabel } from '@/features/shared/enum-labels';
import { broadcastStatusTone } from '@/lib/status-tokens';
import { formatDateTime, formatNumber } from '@/lib/format';

export interface BroadcastHistoryProps {
  rows: BroadcastDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** Read-only history of broadcasts with live status pill and send/fail counts. */
export function BroadcastHistory({ rows, isLoading, isError, onRetry }: BroadcastHistoryProps) {
  const copy = featureStrings.broadcast;

  const columns: Column<BroadcastDto>[] = [
    {
      key: 'message',
      header: copy.columns.message,
      render: (row) => (
        <div className="max-w-md">
          <p className="line-clamp-2 text-text">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: copy.columns.status,
      render: (row) => (
        <StatusPill
          tone={broadcastStatusTone(row.status)}
          label={broadcastStatusLabel[row.status]}
          pulse={row.status === BroadcastStatus.SENDING}
        />
      ),
    },
    {
      key: 'targets',
      header: copy.columns.targets,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.totalTargets,
      render: (row) => <span className="tabular-nums">{formatNumber(row.totalTargets)}</span>,
    },
    {
      key: 'sent',
      header: copy.columns.sent,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.sentCount,
      render: (row) => (
        <span className="tabular-nums text-success">{formatNumber(row.sentCount)}</span>
      ),
    },
    {
      key: 'failed',
      header: copy.columns.failed,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.failedCount,
      render: (row) => (
        <span className={row.failedCount > 0 ? 'tabular-nums text-danger' : 'tabular-nums text-text-muted'}>
          {formatNumber(row.failedCount)}
        </span>
      ),
    },
    {
      key: 'time',
      header: copy.columns.time,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => <span className="text-text-muted">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <Card title={copy.historyTitle} noPadding>
      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={onRetry}>
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={20} />
      </QueryBoundary>
    </Card>
  );
}
