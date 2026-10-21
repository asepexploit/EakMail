import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronDown, ChevronUp, Trash2, RotateCcw,
  Activity, Server, Zap, Layers,
} from 'lucide-react';
import { http } from '@/lib/http';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

interface RepeatableJobInfo {
  queue: string;
  key: string;
  name: string;
  every: number | null;
  next: number;
}

interface BackgroundProcess {
  name: string;
  accountId: string;
  accountLabel: string;
  running: boolean;
}

interface MonitorData {
  queues: QueueStats[];
  repeatableJobs: RepeatableJobInfo[];
  backgroundProcesses: BackgroundProcess[];
}

interface FailedJobInfo {
  queue: string;
  id: string;
  name: string;
  failedReason: string;
  timestamp: number;
  attemptsMade: number;
  data: Record<string, unknown>;
}

// ── API hooks ────────────────────────────────────────────────────────────────

function useMonitorData() {
  return useQuery<MonitorData>({
    queryKey: ['queue-monitor'],
    queryFn: () => http.get('/queue-monitor'),
    refetchInterval: 10_000,
  });
}

function useFailedJobs() {
  return useQuery<{ failed: FailedJobInfo[] }>({
    queryKey: ['queue-monitor-failed'],
    queryFn: () => http.get('/queue-monitor/failed?limit=50'),
    refetchInterval: 15_000,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatInterval(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}d`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60 * 10) / 10;
  return `${hr}j`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const d = Math.floor(hr / 24);
  return `${d} hari lalu`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const QUEUE_LABELS: Record<string, string> = {
  'order-fulfillment': 'Order Fulfillment',
  'workflow-run': 'Workflow Run',
  'payment-poll': 'Payment Polling',
  'notifications': 'Notifikasi',
  'promotion': 'Promosi',
  'bulk-join': 'Bulk Join Grup',
};

const PROCESS_LABELS: Record<string, string> = {
  'auto-reply': 'Auto Reply DM',
  'auto-join': 'Auto Join Monitor',
  'auto-search': 'Auto Search Grup',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, value, label, tone }: {
  icon: typeof Activity;
  value: string | number;
  label: string;
  tone: 'success' | 'brand' | 'danger' | 'warning' | 'muted';
}) {
  const toneMap = {
    success: 'border-success/30 bg-success/5',
    brand: 'border-brand/30 bg-brand/5',
    danger: 'border-danger/30 bg-danger/5',
    warning: 'border-warning/30 bg-warning/5',
    muted: 'border-border bg-card',
  };
  const iconTone = {
    success: 'text-success',
    brand: 'text-brand',
    danger: 'text-danger',
    warning: 'text-warning',
    muted: 'text-text-muted',
  };
  const valueTone = {
    success: 'text-text',
    brand: 'text-text',
    danger: 'text-danger',
    warning: 'text-warning',
    muted: 'text-text',
  };

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-5 py-4 min-w-[160px]', toneMap[tone])}>
      <Icon className={cn('h-5 w-5 shrink-0', iconTone[tone])} />
      <div>
        <p className={cn('text-xl font-bold leading-tight', valueTone[tone])}>{value}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function QueueCard({ q }: { q: QueueStats }) {
  const total = q.waiting + q.active + q.delayed;
  const hasIssue = q.failed > 0;
  const isActive = q.active > 0;
  const label = QUEUE_LABELS[q.name] ?? q.name;

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      hasIssue ? 'border-danger/30 bg-danger/5' : isActive ? 'border-brand/30 bg-brand/5' : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">{label}</h3>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">{q.name}</p>
        </div>
        {isActive ? (
          <div className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span className="text-[10px] font-semibold text-brand">AKTIF</span>
          </div>
        ) : total === 0 && q.failed === 0 ? (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span className="text-[10px] font-semibold text-success">IDLE</span>
          </div>
        ) : hasIssue ? (
          <div className="flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1">
            <AlertTriangle className="h-3 w-3 text-danger" />
            <span className="text-[10px] font-semibold text-danger">ERROR</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
            <Clock className="h-3 w-3 text-text-muted" />
            <span className="text-[10px] font-semibold text-text-muted">IDLE</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Menunggu" value={q.waiting} tone={q.waiting > 5 ? 'warning' : undefined} />
        <StatBox label="Aktif" value={q.active} tone={q.active > 0 ? 'brand' : undefined} />
        <StatBox label="Tertunda" value={q.delayed} />
        <StatBox label="Selesai" value={q.completed} tone="success" />
        <StatBox label="Gagal" value={q.failed} tone={q.failed > 0 ? 'danger' : undefined} />
        <StatBox label="Dijeda" value={q.paused} />
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warning' | 'success' | 'brand' }) {
  const colors = {
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success',
    brand: 'text-brand',
  };

  return (
    <div className="text-center rounded-lg bg-surface/50 py-1.5 px-1">
      <p className={cn('text-sm font-bold', tone ? colors[tone] : 'text-text')}>{value.toLocaleString('id-ID')}</p>
      <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function ProcessRow({ p }: { p: BackgroundProcess }) {
  const processLabel = PROCESS_LABELS[p.name] ?? p.name;

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-surface-hover transition-colors">
      <div className={cn(
        'h-2.5 w-2.5 rounded-full shrink-0 ring-2',
        p.running
          ? 'bg-success ring-success/20 animate-pulse'
          : 'bg-text-muted/40 ring-text-muted/10',
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text">{processLabel}</span>
          <span className="text-[10px] text-text-muted font-mono">#{p.accountId}</span>
        </div>
        <p className="text-[11px] text-text-muted truncate mt-0.5">{p.accountLabel}</p>
      </div>
      <span className={cn(
        'text-[11px] font-semibold px-2.5 py-1 rounded-full',
        p.running
          ? 'bg-success/10 text-success'
          : 'bg-surface text-text-muted',
      )}>
        {p.running ? 'Running' : 'Stopped'}
      </span>
    </div>
  );
}

function RepeatableRow({ job }: { job: RepeatableJobInfo }) {
  const queueLabel = QUEUE_LABELS[job.queue] ?? job.queue;

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-surface-hover transition-colors">
      <Zap className="h-3.5 w-3.5 text-brand shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text">{queueLabel}</span>
          {job.every && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              setiap {formatInterval(job.every)}
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-muted font-mono truncate mt-0.5">{job.key}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] text-text-muted">Berikutnya</p>
        <p className="text-xs font-semibold text-text">{formatTime(job.next)}</p>
      </div>
    </div>
  );
}

function FailedJobRow({ job }: { job: FailedJobInfo }) {
  const [open, setOpen] = useState(false);
  const queueLabel = QUEUE_LABELS[job.queue] ?? job.queue;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-3 px-4 text-left hover:bg-surface-hover transition-colors"
      >
        <XCircle className="h-4 w-4 shrink-0 text-danger" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">{queueLabel}</span>
            <span className="text-[10px] text-text-muted">ID: {job.id}</span>
          </div>
          <p className="text-[11px] text-danger/80 truncate mt-0.5">{job.failedReason}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-text-muted">{timeAgo(job.timestamp)}</p>
            <p className="text-[10px] text-text-muted">{job.attemptsMade}x percobaan</p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 ml-7">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-text-muted">Queue:</span>
              <span className="ml-1 font-medium text-text">{job.queue}</span>
            </div>
            <div>
              <span className="text-text-muted">Job Name:</span>
              <span className="ml-1 font-medium text-text">{job.name}</span>
            </div>
            <div>
              <span className="text-text-muted">Attempts:</span>
              <span className="ml-1 font-medium text-text">{job.attemptsMade}</span>
            </div>
            <div>
              <span className="text-text-muted">Waktu:</span>
              <span className="ml-1 font-medium text-text">{new Date(job.timestamp).toLocaleString('id-ID')}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Error</p>
            <p className="text-[11px] text-danger font-mono whitespace-pre-wrap bg-danger/5 rounded-lg p-2.5 border border-danger/10">{job.failedReason}</p>
          </div>
          {Object.keys(job.data).length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Job Data</p>
              <pre className="rounded-lg bg-surface p-2.5 text-[11px] text-text-muted overflow-x-auto max-h-32 border border-border">
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count, actions }: {
  icon: typeof Activity;
  title: string;
  count?: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {count != null && (
          <span className="text-[11px] text-text-muted bg-surface rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      {actions}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function SystemMonitorPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useMonitorData();
  const failedQuery = useFailedJobs();
  const [clearing, setClearing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const runningCount = data?.backgroundProcesses.filter((p) => p.running).length ?? 0;
  const totalProcesses = data?.backgroundProcesses.length ?? 0;
  const totalFailed = data?.queues.reduce((s, q) => s + q.failed, 0) ?? 0;
  const totalActive = data?.queues.reduce((s, q) => s + q.active, 0) ?? 0;
  const totalCompleted = data?.queues.reduce((s, q) => s + q.completed, 0) ?? 0;

  const handleClearFailed = async () => {
    setClearing(true);
    try {
      await http.delete('/queue-monitor/failed');
      queryClient.invalidateQueries({ queryKey: ['queue-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['queue-monitor-failed'] });
    } finally {
      setClearing(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      await http.post('/queue-monitor/retry-failed');
      queryClient.invalidateQueries({ queryKey: ['queue-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['queue-monitor-failed'] });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitor"
        description="Pantau status antrian, proses background, jadwal otomatis, dan error secara real-time"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { refetch(); failedQuery.refetch(); }}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data sistem...
        </div>
      ) : data ? (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              icon={Activity}
              value={`${runningCount}/${totalProcesses}`}
              label="Proses Aktif"
              tone={runningCount === totalProcesses ? 'success' : runningCount > 0 ? 'warning' : 'muted'}
            />
            <SummaryCard
              icon={Zap}
              value={totalActive}
              label="Job Sedang Jalan"
              tone={totalActive > 0 ? 'brand' : 'muted'}
            />
            <SummaryCard
              icon={Layers}
              value={data.repeatableJobs.length}
              label="Jadwal Otomatis"
              tone="muted"
            />
            <SummaryCard
              icon={AlertTriangle}
              value={totalFailed}
              label="Job Gagal"
              tone={totalFailed > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* ── Statistik Selesai ── */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-text-muted" />
                <span className="text-sm font-semibold text-text">Ringkasan Total</span>
              </div>
              <span className="text-[11px] text-text-muted">Sejak restart terakhir</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
              {data.queues.map((q) => (
                <div key={q.name} className="text-center">
                  <p className="text-lg font-bold text-text">{q.completed.toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-text-muted">{QUEUE_LABELS[q.name] ?? q.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Queue Stats ── */}
          <section>
            <SectionHeader icon={Layers} title="Antrian (Queues)" count={data.queues.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.queues.map((q) => <QueueCard key={q.name} q={q} />)}
            </div>
          </section>

          {/* ── Background Processes ── */}
          <section>
            <SectionHeader
              icon={Activity}
              title="Proses Background"
              count={runningCount}
              actions={
                <span className="text-[11px] text-text-muted">
                  {runningCount} aktif dari {totalProcesses} terdaftar
                </span>
              }
            />
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {data.backgroundProcesses.length === 0 ? (
                <p className="text-center text-xs text-text-muted py-8">Tidak ada proses terdaftar</p>
              ) : (
                data.backgroundProcesses.map((p) => (
                  <ProcessRow key={`${p.name}-${p.accountId}`} p={p} />
                ))
              )}
            </div>
          </section>

          {/* ── Repeatable Jobs ── */}
          <section>
            <SectionHeader icon={Zap} title="Jadwal Otomatis (Repeatable)" count={data.repeatableJobs.length} />
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {data.repeatableJobs.length === 0 ? (
                <p className="text-center text-xs text-text-muted py-8">Tidak ada jadwal otomatis</p>
              ) : (
                data.repeatableJobs.map((j) => (
                  <RepeatableRow key={j.key} job={j} />
                ))
              )}
            </div>
          </section>

          {/* ── Failed Jobs ── */}
          <section>
            <SectionHeader
              icon={XCircle}
              title="Job Gagal"
              count={failedQuery.data?.failed.length}
              actions={
                totalFailed > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRetryFailed}
                      disabled={retrying}
                    >
                      <RotateCcw className={cn('h-3 w-3 mr-1', retrying && 'animate-spin')} />
                      Retry Semua
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleClearFailed}
                      disabled={clearing}
                    >
                      <Trash2 className={cn('h-3 w-3 mr-1', clearing && 'animate-spin')} />
                      Hapus Semua
                    </Button>
                  </div>
                ) : undefined
              }
            />
            <div className="rounded-xl border border-border bg-card">
              {failedQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-text-muted" />
                  <p className="text-xs text-text-muted">Memuat...</p>
                </div>
              ) : !failedQuery.data?.failed.length ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <CheckCircle2 className="h-8 w-8 text-success/50" />
                  <p className="text-xs text-text-muted">Tidak ada job yang gagal</p>
                </div>
              ) : (
                failedQuery.data.failed.map((j) => (
                  <FailedJobRow key={`${j.queue}-${j.id}`} job={j} />
                ))
              )}
            </div>
          </section>

          {/* ── Footer info ── */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-text-muted py-2">
            <span>Auto-refresh setiap 10 detik</span>
            <span>&middot;</span>
            <span>Total job selesai: {totalCompleted.toLocaleString('id-ID')}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
