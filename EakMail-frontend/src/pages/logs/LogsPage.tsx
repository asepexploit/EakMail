import { useMemo, useState } from 'react';
import { WsEventType, ExecutionState } from '@eakmail/shared-types';
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
import { StatusPill } from '@/components/ui/StatusPill';
import { strings } from '@/lib/strings';
import type { StatusTone } from '@/lib/status-tokens';
import { executionStateTone } from '@/lib/status-tokens';
import { executionStateLabel } from '@/features/shared/enum-labels';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useExecutions, useExecution } from '@/features/monitoring/api/useExecutions';
import { useExecutionStream } from '@/lib/useExecutionStream';
import { useDeadLetter, useRetryDeadLetterJob, useAuditLog } from '@/features/logs/api/useLogs';
import type { DeadLetterJobDto, AuditEntry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

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

const stepTone = (status: string): StatusTone =>
  status === 'SUCCESS' ? 'success' : status === 'ERROR' ? 'danger' : status === 'RUNNING' ? 'info' : 'neutral';

/** Live Log sub-panel — execution picker + step log + optional live WS stream. */
function LiveLogPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');

  const executionsQuery = useExecutions({ pageSize: 30 });
  const detailQuery = useExecution(selectedId);
  const isRunning = detailQuery.data?.state === ExecutionState.RUNNING;
  const stream = useExecutionStream(isRunning ? selectedId : null);

  // Lines from WS stream (real-time, only when running).
  const streamLines = useMemo<LogLine[]>(() => {
    const toneFor = (l: string): StatusTone =>
      l === 'warn' ? 'warning' : l === 'error' ? 'danger' : 'neutral';
    return stream.events
      .filter((e) => e.type === WsEventType.LOG)
      .map((e, i) => {
        const le = e as Extract<typeof e, { type: typeof WsEventType.LOG }>;
        return {
          id: `ws-${le.ts}-${i}`,
          timestamp: le.ts,
          label: le.level.toUpperCase(),
          message: le.message,
          tone: toneFor(le.level),
          _level: le.level,
        };
      })
      .filter((l) => (level ? l._level === level : true))
      .filter((l) => (search ? l.message.toLowerCase().includes(search.toLowerCase()) : true))
      .map(({ _level, ...l }) => { void _level; return l; });
  }, [stream.events, level, search]);

  // Lines from stored steps (always available after execution).
  const stepLines = useMemo<LogLine[]>(() => {
    if (!detailQuery.data?.steps) return [];
    return detailQuery.data.steps.flatMap((step, i) => {
      const lines: LogLine[] = [];
      lines.push({
        id: `step-${step.id}-start`,
        timestamp: step.ts,
        label: step.nodeType,
        message: `[${step.status}] node ${step.nodeId}`,
        tone: stepTone(step.status),
      });
      if (step.error) {
        lines.push({
          id: `step-${step.id}-err`,
          timestamp: step.ts,
          label: 'ERROR',
          message: step.error,
          tone: 'danger',
        });
      }
      void i;
      return lines;
    }).filter((l) => (search ? l.message.toLowerCase().includes(search.toLowerCase()) : true));
  }, [detailQuery.data?.steps, search]);

  const lines = isRunning ? streamLines : stepLines;

  return (
    <Card noPadding>
      <div className="flex h-[540px] overflow-hidden">
        {/* Execution list */}
        <div className="w-60 shrink-0 border-r border-border overflow-y-auto">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Eksekusi Terbaru</p>
          </div>
          <QueryBoundary
            isLoading={executionsQuery.isLoading}
            isError={executionsQuery.isError}
            onRetry={executionsQuery.refetch}
          >
            {executionsQuery.data?.items.length === 0 && (
              <p className="px-3 py-6 text-xs text-text-muted text-center">Belum ada eksekusi</p>
            )}
            <ul className="py-1">
              {(executionsQuery.data?.items ?? []).map((exec) => (
                <li key={exec.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(exec.id)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left transition hover:bg-surface-2/50',
                      selectedId === exec.id && 'bg-brand/10 border-l-2 border-brand',
                    )}
                  >
                    <p className="font-mono text-[11px] text-text truncate">{exec.id.slice(0, 18)}…</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <StatusPill
                        tone={executionStateTone(exec.state)}
                        label={executionStateLabel[exec.state]}
                        pulse={exec.state === ExecutionState.RUNNING}
                      />
                      <span className="text-[10px] text-text-muted">{exec.startedAt ? formatDateTime(exec.startedAt) : '—'}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </div>

        {/* Log viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-3 py-2">
            <div className="w-36">
              <Select
                label={featureStrings.logs.filterLevel}
                options={levelOptions}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-48">
              <Input
                label={featureStrings.logs.filterSearch}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={strings.actions.search}
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-3">
            {!selectedId ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-muted">← Pilih eksekusi untuk melihat log-nya</p>
              </div>
            ) : (
              <>
                {isRunning && (
                  <p className="mb-2 text-xs text-brand-accent">{featureStrings.logs.liveHint}</p>
                )}
                <QueryBoundary
                  isLoading={detailQuery.isLoading}
                  isError={detailQuery.isError}
                  onRetry={detailQuery.refetch}
                >
                  <LiveLog lines={lines} height={400} />
                </QueryBoundary>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Logs (Log) page — live stream, dead-letter, audit (DESIGN_SYSTEM.md §9.2). */
export function LogsPage() {
  const [tab, setTab] = useState<TabId>('live');
  const [auditPage, setAuditPage] = useState(1);

  const deadLetterQuery = useDeadLetter();
  const retryJob = useRetryDeadLetterJob();
  const auditQuery = useAuditLog(auditPage, 50);

  const tabs = [
    { value: 'live' as const, label: featureStrings.logs.tabs.live },
    { value: 'deadLetter' as const, label: featureStrings.logs.tabs.deadLetter },
    { value: 'audit' as const, label: featureStrings.logs.tabs.audit },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.logs} description={featureStrings.logs.subtitle} />

      <Tabs tabs={tabs} value={tab} onChange={(value) => setTab(value as TabId)} />

      {tab === 'live' && <LiveLogPanel />}

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
