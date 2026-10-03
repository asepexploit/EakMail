import { useState } from 'react';
import { Activity, RefreshCw, Wifi, WifiOff, Clock, Radio, LogIn, ScanEye, ListOrdered, MessageSquare, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useMonitorAccounts,
  useUpdateMonitor,
  useSyncAccountGroups,
  useLeaveReadOnly,
  type MonitorAccountRow,
} from '@/features/monitor/api/useMonitor';

const MAX_OPTIONS = [2, 3, 5, 8, 10, 15, 20];

export default function MonitorAccountsPage() {
  const { data: accounts = [], isLoading } = useMonitorAccounts();
  const updateMonitor = useUpdateMonitor();
  const syncGroups = useSyncAccountGroups();
  const leaveReadOnly = useLeaveReadOnly();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Akun Monitor</h1>
        <p className="text-sm text-text-muted">
          Pantau semua grup secara live — deteksi link, auto-join, cek izin kirim
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Memuat...</p>
      ) : accounts.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <ScanEye className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada akun. Tambah akun di halaman Akun Promosi.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((acc) => (
            <MonitorAccountCard
              key={acc.id}
              account={acc}
              onToggle={(enabled, max) =>
                updateMonitor.mutate({ id: acc.id, autoJoinEnabled: enabled, autoJoinMaxPerHour: max })
              }
              onToggleLog={(enabled) =>
                updateMonitor.mutate({ id: acc.id, messageLogEnabled: enabled })
              }
              onSync={() => syncGroups.mutate(acc.id)}
              isSyncing={syncGroups.isPending && syncGroups.variables === acc.id}
              onLeaveReadOnly={() => leaveReadOnly.mutate(acc.id)}
              isLeavingReadOnly={leaveReadOnly.isPending && leaveReadOnly.variables === acc.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MonitorAccountCardProps {
  account: MonitorAccountRow;
  onToggle: (enabled: boolean, max: number) => void;
  onToggleLog: (enabled: boolean) => void;
  onSync: () => void;
  isSyncing: boolean;
  onLeaveReadOnly: () => void;
  isLeavingReadOnly: boolean;
}

function MonitorAccountCard({ account: a, onToggle, onToggleLog, onSync, isSyncing, onLeaveReadOnly, isLeavingReadOnly }: MonitorAccountCardProps) {
  const [localMax, setLocalMax] = useState(a.autoJoinMaxPerHour);

  const isConnected = a.status === 'CONNECTED';

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-text">{a.label}</p>
            {a.monitorRunning ? (
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <Activity className="h-3 w-3" />
                Live
              </span>
            ) : (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-text-muted">Nonaktif</span>
            )}
          </div>
          <p className="text-xs font-mono text-text-muted">+{a.phone}</p>
        </div>
        {/* Big toggle */}
        <button
          type="button"
          onClick={() => onToggle(!a.autoJoinEnabled, localMax)}
          disabled={!isConnected}
          title={!isConnected ? 'Akun belum terhubung' : undefined}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${
            a.autoJoinEnabled ? 'bg-brand' : 'bg-surface-hover'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${a.autoJoinEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 divide-x divide-border border-y border-border bg-surface/50 text-center">
        {[
          { label: 'Aktif', value: a.groupStats.active, icon: <Wifi className="h-3.5 w-3.5" />, color: 'text-success' },
          { label: 'Read-only', value: a.groupStats.readOnly, icon: <WifiOff className="h-3.5 w-3.5" />, color: 'text-warning' },
          { label: 'Keluar', value: a.groupStats.left, icon: <LogIn className="h-3.5 w-3.5 rotate-180" />, color: 'text-text-muted' },
          { label: 'Join hari ini', value: a.groupStats.todayJoins, icon: <Clock className="h-3.5 w-3.5" />, color: 'text-brand' },
          { label: 'Antri', value: a.queuePending, icon: <ListOrdered className="h-3.5 w-3.5" />, color: a.queuePending > 0 ? 'text-amber-400' : 'text-text-muted' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 py-3">
            <span className={`text-text-muted ${color}`}>{icon}</span>
            <span className={`text-base font-bold leading-none ${color}`}>{value}</span>
            <span className="text-[10px] leading-tight text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Maks. auto-join per jam</span>
          <div className="flex gap-1">
            {MAX_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setLocalMax(n);
                  if (a.autoJoinEnabled) onToggle(true, n);
                }}
                className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                  localMax === n ? 'bg-brand text-white' : 'bg-surface text-text-muted hover:bg-surface-hover'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted bg-surface/60 rounded px-2 py-1.5">
          <Radio className="h-3 w-3 shrink-0" />
          Delay acak 30s–3 mnt · De-duplikasi 24 jam · Leave otomatis jika read-only
        </div>
        {a.queuePending > 0 && (
          <div className="flex items-center gap-2 text-[11px] bg-amber-500/10 text-amber-400 rounded px-2 py-1.5">
            <ListOrdered className="h-3 w-3 shrink-0" />
            <span><strong>{a.queuePending}</strong> link sedang antri — akan diproses otomatis sesuai limit per jam</span>
          </div>
        )}

        {/* Message log toggle */}
        <div className="flex items-center justify-between rounded border border-border px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-text">
            <MessageSquare className="h-3.5 w-3.5 text-text-muted" />
            Catat pesan grup
          </div>
          <button
            type="button"
            onClick={() => onToggleLog(!a.messageLogEnabled)}
            disabled={!isConnected}
            title={!isConnected ? 'Akun belum terhubung' : undefined}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${
              a.messageLogEnabled ? 'bg-brand' : 'bg-surface-hover'
            }`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${a.messageLogEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onSync} isLoading={isSyncing} disabled={!isConnected} className="flex-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Sinkron grup
          </Button>
          {a.groupStats.readOnly > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-warning"
              onClick={onLeaveReadOnly}
              isLoading={isLeavingReadOnly}
              disabled={!isConnected}
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave read-only ({a.groupStats.readOnly})
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
