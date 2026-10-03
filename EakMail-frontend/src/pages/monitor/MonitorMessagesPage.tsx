import { useState } from 'react';
import { MessageSquare, Link2, Activity, Filter } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useMonitorMessages, useMonitorAccounts } from '@/features/monitor/api/useMonitor';

export default function MonitorMessagesPage() {
  const [filterAccountId, setFilterAccountId] = useState('');
  const [onlyLinks, setOnlyLinks] = useState(false);

  const { data: accounts = [] } = useMonitorAccounts();
  const { data: messages = [], isLoading, dataUpdatedAt } = useMonitorMessages(
    filterAccountId || undefined,
    onlyLinks || undefined,
  );

  const linkCount = messages.filter((m) => m.hasLink).length;
  const loggedAccounts = accounts.filter((a) => a.messageLogEnabled);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text">Log Pesan</h1>
            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">
              <Activity className="h-3 w-3 animate-pulse" />
              Auto-refresh 5s
            </span>
          </div>
          <p className="text-sm text-text-muted">
            {messages.length} pesan · {linkCount} mengandung link ·{' '}
            {loggedAccounts.length === 0
              ? 'Log belum aktif — aktifkan di Akun Monitor'
              : `${loggedAccounts.length} akun aktif`}{' '}
            · diperbarui {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('id-ID') : '—'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-text-muted" />
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1.5 text-xs text-text focus:outline-none"
          >
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-muted">
            <input
              type="checkbox"
              checked={onlyLinks}
              onChange={(e) => setOnlyLinks(e.target.checked)}
              className="rounded accent-brand"
            />
            Hanya yang ada link
          </label>
        </div>
      </div>

      {/* No log enabled notice */}
      {loggedAccounts.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <MessageSquare className="h-4 w-4 shrink-0" />
          Log pesan belum diaktifkan. Buka <strong>Akun Monitor</strong> → aktifkan toggle <em>"Catat pesan"</em> pada akun yang ingin dipantau.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-muted">Memuat...</p>
      ) : messages.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada pesan. Pastikan akun terhubung dan log pesan diaktifkan.</p>
        </Card>
      ) : (
        <div className="space-y-1">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} showAccount={!filterAccountId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MessageRowProps {
  msg: {
    id: string;
    accountLabel: string;
    chatTitle: string;
    senderName: string | null;
    text: string;
    hasLink: boolean;
    ts: string;
  };
  showAccount: boolean;
}

function MessageRow({ msg, showAccount }: MessageRowProps) {
  const time = new Date(msg.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = new Date(msg.ts).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });

  return (
    <div className={`group flex gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface/60 ${msg.hasLink ? 'border border-brand/20 bg-brand/5' : ''}`}>
      {/* Time */}
      <div className="shrink-0 text-right w-[72px]">
        <p className="text-[11px] font-mono text-text-muted leading-tight">{time}</p>
        <p className="text-[10px] text-text-muted/60 leading-tight">{date}</p>
      </div>

      {/* Group + sender */}
      <div className="shrink-0 w-[140px] min-w-0">
        <p className="truncate text-[11px] font-medium text-text leading-tight">{msg.chatTitle}</p>
        <p className="truncate text-[10px] text-text-muted leading-tight">
          {msg.senderName ?? 'Channel'}
        </p>
        {showAccount && (
          <p className="truncate text-[10px] text-brand/70 leading-tight">{msg.accountLabel}</p>
        )}
      </div>

      {/* Message text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text leading-relaxed break-words">
          {msg.hasLink && <Link2 className="inline h-3 w-3 text-brand mr-1 shrink-0" />}
          {msg.text}
        </p>
      </div>
    </div>
  );
}
