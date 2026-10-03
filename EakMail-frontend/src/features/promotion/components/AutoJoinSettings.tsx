/**
 * Collapsible auto-join monitor panel inside AccountCard.
 * Toggle monitor on/off, set max joins per hour, view recent auto-join log.
 */
import { useState } from 'react';
import { Radio, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Activity } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { Button } from '@/components/ui/Button';

interface MonitorStatus {
  autoJoinEnabled: boolean;
  autoJoinMaxPerHour: number;
  monitorRunning: boolean;
}

interface AutoJoinLogEntry {
  id: string;
  sourceGroup: string;
  targetGroup: string;
  rawLink: string;
  ok: boolean;
  alreadyMember: boolean;
  error: string | null;
  joinedAt: string;
}

function useMonitorStatus(accountId: string) {
  return useQuery<MonitorStatus>({
    queryKey: ['auto-join-status', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/auto-join/status`),
    refetchInterval: 15_000,
  });
}

function useAutoJoinLogs(accountId: string, enabled: boolean) {
  return useQuery<AutoJoinLogEntry[]>({
    queryKey: ['auto-join-logs', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/auto-join/logs`, { query: { limit: 50 } }),
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  });
}

function useUpdateAutoJoin(accountId: string) {
  const qc = useQueryClient();
  return useMutation<MonitorStatus, Error, { autoJoinEnabled: boolean; autoJoinMaxPerHour: number }>({
    mutationFn: (body) => http.patch(`/promotion/accounts/${accountId}/auto-join`, body),
    onSuccess: (data) => {
      qc.setQueryData(['auto-join-status', accountId], data);
    },
  });
}

interface AutoJoinSettingsProps {
  accountId: string;
}

export function AutoJoinSettings({ accountId }: AutoJoinSettingsProps) {
  const [open, setOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const { data: status, isLoading } = useMonitorStatus(accountId);
  const { data: logs = [] } = useAutoJoinLogs(accountId, showLogs);
  const updateMutation = useUpdateAutoJoin(accountId);

  const enabled = status?.autoJoinEnabled ?? false;
  const maxPerHour = status?.autoJoinMaxPerHour ?? 5;
  const running = status?.monitorRunning ?? false;

  function handleToggle() {
    updateMutation.mutate({
      autoJoinEnabled: !enabled,
      autoJoinMaxPerHour: maxPerHour,
    });
  }

  function handleMaxChange(val: number) {
    if (!status) return;
    updateMutation.mutate({ autoJoinEnabled: enabled, autoJoinMaxPerHour: val });
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors text-text-muted hover:text-text"
      >
        <span className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          Monitor Auto-Join
          {running && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
              <Activity className="h-2.5 w-2.5" />
              Aktif
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {isLoading ? (
            <p className="text-xs text-text-muted">Memuat...</p>
          ) : (
            <>
              {/* Toggle + limit */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-text">Auto-join link dari pesan grup</p>
                  <p className="text-[11px] text-text-muted">
                    Deteksi link t.me di semua grup, join otomatis dengan delay acak (30s–3 menit)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={updateMutation.isPending}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    enabled ? 'bg-brand' : 'bg-surface-hover'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {enabled && (
                <div className="rounded-lg border border-border bg-surface/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-text-muted">Maks. join per jam</label>
                    <div className="flex items-center gap-1">
                      {[2, 3, 5, 8, 10, 15].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleMaxChange(n)}
                          disabled={updateMutation.isPending}
                          className={`rounded px-2 py-1 text-xs transition-colors ${
                            maxPerHour === n
                              ? 'bg-brand text-white'
                              : 'bg-surface text-text-muted hover:bg-surface-hover'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Delay acak 30s–3 menit per link · De-duplikasi 24 jam · Skip jika sudah member
                  </p>
                  {running && (
                    <div className="flex items-center gap-1.5 text-[11px] text-success">
                      <Activity className="h-3 w-3" />
                      Monitor sedang berjalan — memantau {maxPerHour} grup/jam maks.
                    </div>
                  )}
                </div>
              )}

              {/* Log toggle */}
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className="text-xs text-brand hover:underline"
              >
                {showLogs ? '▲ Sembunyikan log' : '▼ Lihat log auto-join'}
              </button>

              {showLogs && (
                <div className="space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-xs text-text-muted py-2 text-center">Belum ada aktivitas auto-join</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden max-h-60 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 px-3 py-2 text-xs ${
                            i > 0 ? 'border-t border-border' : ''
                          } ${log.ok ? 'bg-success/5' : 'bg-danger/5'}`}
                        >
                          {log.ok ? (
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-text">{log.rawLink}</p>
                            <p className="text-text-muted">
                              dari <span className="font-mono">{log.sourceGroup}</span>
                              <span className="mx-1">·</span>
                              {new Date(log.joinedAt).toLocaleString('id-ID')}
                            </p>
                            {log.alreadyMember && (
                              <p className="flex items-center gap-1 text-text-muted">
                                <AlertCircle className="h-3 w-3" />
                                Sudah member
                              </p>
                            )}
                            {log.error && <p className="text-danger">{log.error}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
