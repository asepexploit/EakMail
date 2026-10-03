import { useMemo, useState } from 'react';
import { WsEventType } from '@eakmail/shared-types';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Input,
  JsonViewer,
  Select,
  Tabs,
  LiveLog,
  type Column,
  type LogLine,
} from '@/components/ui';
import { strings } from '@/lib/strings';
import type { StatusTone } from '@/lib/status-tokens';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useExecutions } from '@/features/monitoring/api/useExecutions';
import { useExecutionStream } from '@/lib/useExecutionStream';
import { useDeadLetter, useRetryDeadLetterJob, useAuditLog } from '@/features/logs/api/useLogs';
import type { DeadLetterJobDto, AuditEntry } from '@/lib/api';

type TabId = 'live' | 'deadLetter' | 'audit';

const levelOptions = [
  { value: '', label: strings.common.all },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' },
];

const deadLetterColumns: Column<DeadLetterJobDto>[] = [
  { key: 'queue', header: 'Queue', render: (r) => <Badge tone="neutral">{r.queue}</Badge> },
  { key: 'name', header: 'Job', render: (r) => <span className="font-mono text-xs">{r.name}</span> },
  {
    key: 'failedReason',
    header: 'Alasan Gagal',
    render: (r) => <span className="max-w-xs truncate text-xs text-danger">{r.failedReason}</span>,
  },
  { key: 'attemptsMade', header: 'Percobaan', render: (r) => String(r.attemptsMade) },
  {
    key: 'finishedOn',
    header: 'Waktu Gagal',
    render: (r) =>
      r.finishedOn ? new Date(r.finishedOn).toLocaleString('id-ID') : '—',
  },
  { key: 'data', header: 'Data', render: (r) => <JsonViewer value={r.data} maxHeight={80} /> },
];

const auditColumns: Column<AuditEntry>[] = [
  {
    key: 'ts',
    header: 'Waktu',
    render: (r) => <span className="whitespace-nowrap text-xs">{new Date(r.ts).toLocaleString('id-ID')}</span>,
  },
  { key: 'adminEmail', header: 'Admin', render: (r) => r.adminEmail ?? '—' },
  { key: 'action', header: 'Aksi', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
  { key: 'target', header: 'Target', render: (r) => r.target ?? '—' },
];

/** Logs (Log) page — live stream, dead-letter, audit (DESIGN_SYSTEM.md §9.2). */
export function LogsPage() {
  const [tab, setTab] = useState<TabId>('live');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // Live logs follow the most recent running execution's stream.
  const executionsQuery = useExecutions({ pageSize: 1 });
  const latestExecutionId = executionsQuery.data?.items[0]?.id ?? null;
  const stream = useExecutionStream(tab === 'live' ? latestExecutionId : null);

  const deadLetterQuery = useDeadLetter();
  const retryJob = useRetryDeadLetterJob();
  const auditQuery = useAuditLog(auditPage, 50);

  const lines = useMemo<LogLine[]>(() => {
    const toneFor = (logLevel: string): StatusTone =>
      logLevel === 'warn' ? 'warning' : logLevel === 'error' ? 'danger' : 'neutral';
    return stream.events
      .filter((event) => event.type === WsEventType.LOG)
      .map((event, index) => {
        const logEvent = event as Extract<typeof event, { type: typeof WsEventType.LOG }>;
        return {
          id: `${logEvent.ts}-${index}`,
          timestamp: logEvent.ts,
          label: 'LOG',
          message: logEvent.message,
          tone: toneFor(logEvent.level),
          _level: logEvent.level,
        };
      })
      .filter((line) => (level ? line._level === level : true))
      .filter((line) => (search ? line.message.toLowerCase().includes(search.toLowerCase()) : true))
      .map(({ _level, ...line }) => {
        void _level;
        return line;
      });
  }, [stream.events, level, search]);

  const tabs = [
    { value: 'live' as const, label: featureStrings.logs.tabs.live },
    { value: 'deadLetter' as const, label: featureStrings.logs.tabs.deadLetter },
    { value: 'audit' as const, label: featureStrings.logs.tabs.audit },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.logs} description={featureStrings.logs.subtitle} />

      <Tabs tabs={tabs} value={tab} onChange={(value) => setTab(value as TabId)} />

      {tab === 'live' && (
        <Card noPadding>
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-3 py-3">
            <div className="w-40">
              <Select
                label={featureStrings.logs.filterLevel}
                options={levelOptions}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Input
                label={featureStrings.logs.filterSearch}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={strings.actions.search}
              />
            </div>
          </div>
          <div className="p-3">
            <p className="mb-2 text-xs text-text-muted">{featureStrings.logs.liveHint}</p>
            <QueryBoundary
              isLoading={executionsQuery.isLoading}
              isError={executionsQuery.isError}
              onRetry={executionsQuery.refetch}
            >
              <LiveLog lines={lines} height={420} />
            </QueryBoundary>
          </div>
        </Card>
      )}

      {tab === 'deadLetter' && (
        <QueryBoundary
          isLoading={deadLetterQuery.isLoading}
          isError={deadLetterQuery.isError}
          onRetry={deadLetterQuery.refetch}
        >
          {deadLetterQuery.data?.items.length === 0 ? (
            <Card>
              <p className="py-12 text-center text-sm text-text-muted">
                {featureStrings.logs.deadLetterEmpty}
              </p>
            </Card>
          ) : (
            <Card noPadding>
              <DataTable
                columns={[
                  ...deadLetterColumns,
                  {
                    key: 'id',
                    header: '',
                    render: (r) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={retryJob.isPending}
                        onClick={() => retryJob.mutate({ queue: r.queue, jobId: r.id })}
                      >
                        Retry
                      </Button>
                    ),
                  },
                ]}
                rows={deadLetterQuery.data?.items ?? []}
                rowKey={(r) => `${r.queue}-${r.id}`}
              />
            </Card>
          )}
        </QueryBoundary>
      )}

      {tab === 'audit' && (
        <QueryBoundary
          isLoading={auditQuery.isLoading}
          isError={auditQuery.isError}
          onRetry={auditQuery.refetch}
        >
          {auditQuery.data?.items.length === 0 && auditPage === 1 ? (
            <Card>
              <p className="py-12 text-center text-sm text-text-muted">
                {featureStrings.logs.auditEmpty}
              </p>
            </Card>
          ) : (
            <Card noPadding>
              <DataTable
                columns={auditColumns}
                rows={auditQuery.data?.items ?? []}
                rowKey={(r) => r.id}
              />
              {auditQuery.data && auditQuery.data.total > auditQuery.data.pageSize && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <span className="text-text-muted">
                    {auditQuery.data.total} entri total
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => p - 1)}
                    >
                      {strings.table.previous}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={auditPage * auditQuery.data.pageSize >= auditQuery.data.total}
                      onClick={() => setAuditPage((p) => p + 1)}
                    >
                      {strings.table.next}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
