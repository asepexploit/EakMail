/**
 * Bulk Join Scheduler — joins all connected promotion accounts to a list of
 * groups one at a time, with a configurable delay between each group.
 * The job runs entirely in the backend (BullMQ); the user can close the page
 * and return later to see progress.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2, Ban, HelpCircle, Trash2 } from 'lucide-react';
import { http } from '@/lib/http';
import type { BulkJoinJobDto, BulkJoinGroupResult } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';

// ── API hooks ─────────────────────────────────────────────────────────────────

interface CreateJobResponse { jobId: string; totalGroups: number; delayMinutes: number }

function useCreateBulkJoin() {
  const qc = useQueryClient();
  return useMutation<CreateJobResponse, Error, { groups: string[]; delayMinutes: number }>({
    mutationFn: (body) => http.post('/promotion/accounts/bulk-join', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-join-jobs'] }),
  });
}

function useBulkJoinJobs() {
  return useQuery<BulkJoinJobDto[]>({
    queryKey: ['bulk-join-jobs'],
    queryFn: () => http.get('/promotion/accounts/bulk-join'),
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (Array.isArray(jobs) && jobs.some((j) => j.status === 'RUNNING')) return 20_000;
      return false;
    },
  });
}

function useBulkJoinDetail(id: string | null) {
  return useQuery<BulkJoinJobDto>({
    queryKey: ['bulk-join-job', id],
    queryFn: () => http.get(`/promotion/accounts/bulk-join/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job?.status === 'RUNNING' ? 10_000 : false;
    },
  });
}

function useCancelBulkJoin() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => http.delete(`/promotion/accounts/bulk-join/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['bulk-join-jobs'] });
      qc.invalidateQueries({ queryKey: ['bulk-join-job', id] });
    },
  });
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'RUNNING') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
      <Loader2 className="h-3 w-3 animate-spin" /> Berjalan
    </span>
  );
  if (status === 'COMPLETED') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
      <CheckCircle2 className="h-3 w-3" /> Selesai
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted">
      <Ban className="h-3 w-3" /> Dibatalkan
    </span>
  );
}

function GroupRow({ g }: { g: BulkJoinGroupResult }) {
  const [open, setOpen] = useState(false);
  const okCount = g.accounts.filter((a) => a.ok || a.alreadyMember).length;
  const requestCount = g.accounts.filter((a) => a.requestSent).length;
  const total = g.accounts.length;

  return (
    <div className="rounded border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
      >
        <span className="shrink-0 text-xs font-mono text-text-muted w-6">#{g.index + 1}</span>
        {g.done ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand animate-spin" />
        )}
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-text">{g.group}</span>
        {g.done && (
          <span className="shrink-0 text-[11px] text-text-muted">
            {okCount}/{total} joined
            {requestCount > 0 && ` · ${requestCount} pending`}
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-muted" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />}
      </button>

      {open && g.done && (
        <div className="border-t border-border px-3 py-2 space-y-1">
          {g.accounts.map((a) => (
            <div key={a.accountId} className="flex items-center gap-2 text-[11px]">
              {a.ok ? (
                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
              ) : a.alreadyMember ? (
                <CheckCircle2 className="h-3 w-3 text-text-muted shrink-0" />
              ) : a.requestSent ? (
                <HelpCircle className="h-3 w-3 text-warning shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-danger shrink-0" />
              )}
              <span className="text-text font-medium">{a.accountLabel}</span>
              <span className="text-text-muted">{a.phone}</span>
              <span className="ml-auto text-text-muted">
                {a.ok ? 'Joined' : a.alreadyMember ? 'Sudah member' : a.requestSent ? 'Pending approval' : (a.error ?? 'Gagal')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: BulkJoinJobDto }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail } = useBulkJoinDetail(expanded ? job.id : null);
  const cancel = useCancelBulkJoin();
  const pct = job.totalGroups > 0 ? Math.round((job.completedGroups / job.totalGroups) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <StatusBadge status={job.status} />
        <span className="text-xs text-text-muted">
          {job.completedGroups}/{job.totalGroups} grup · delay {job.delayMinutes} menit
        </span>
        <span className="ml-auto text-[11px] text-text-muted">
          {new Date(job.createdAt).toLocaleString('id-ID')}
        </span>
        {job.status === 'RUNNING' && (
          <button
            type="button"
            onClick={() => cancel.mutate(job.id)}
            disabled={cancel.isPending}
            className="text-danger hover:text-danger/70 disabled:opacity-50"
            title="Batalkan job"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-brand hover:underline"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Sembunyikan detail' : 'Lihat detail per grup'}
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {detail ? (
            (detail.groups ?? []).map((g) => <GroupRow key={g.index} g={g} />)
          ) : (
            <p className="text-center text-xs text-text-muted py-4">Memuat...</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function BulkJoinScheduledPanel() {
  const [open, setOpen] = useState(false);
  const [groupsText, setGroupsText] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(30);
  const { data: jobs = [] } = useBulkJoinJobs();
  const create = useCreateBulkJoin();

  const groups = groupsText.split('\n').map((s) => s.trim()).filter(Boolean);
  const canSubmit = groups.length > 0 && !create.isPending;

  function handleCreate() {
    create.mutate({ groups, delayMinutes }, {
      onSuccess: () => {
        setGroupsText('');
        setDelayMinutes(30);
      },
    });
  }

  const runningCount = jobs.filter((j) => j.status === 'RUNNING').length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3"
      >
        <Clock className="h-4 w-4 text-brand shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-text">Join Terjadwal (per Grup)</span>
          <p className="text-xs text-text-muted mt-0.5">
            Join semua akun ke setiap grup dengan delay — ditinggal pun tetap jalan di background
          </p>
        </div>
        {runningCount > 0 && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
            {runningCount} berjalan
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-text-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="space-y-4 pt-1">
          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Daftar Grup / Channel <span className="text-danger">*</span>
              </label>
              <p className="mb-2 text-[11px] text-text-muted">
                Satu per baris. Format: @username, https://t.me/username, atau t.me/+InviteHash
              </p>
              <textarea
                rows={6}
                value={groupsText}
                onChange={(e) => setGroupsText(e.target.value)}
                placeholder={'@grupku\nhttps://t.me/grupku2\nt.me/+InviteHash'}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand font-mono resize-y"
              />
              {groups.length > 0 && (
                <p className="mt-1 text-[11px] text-text-muted">{groups.length} grup terdeteksi</p>
              )}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-text-muted">Delay antar grup (menit)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="pb-0.5 text-[11px] text-text-muted whitespace-nowrap">
                {groups.length > 0 && `≈ ${Math.round(groups.length * delayMinutes / 60 * 10) / 10} jam total`}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!canSubmit}
              isLoading={create.isPending}
              className="w-full"
            >
              Jadwalkan Join {groups.length > 0 ? `(${groups.length} grup)` : ''}
            </Button>

            {create.isSuccess && (
              <p className="text-center text-xs text-success">
                ✓ Job dibuat — join akan berlangsung otomatis di background
              </p>
            )}
            {create.isError && (
              <p className="text-center text-xs text-danger">{create.error.message}</p>
            )}
          </div>

          {/* Job list */}
          {jobs.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-text-muted">Riwayat Job</p>
              {jobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
