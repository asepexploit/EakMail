import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Activity, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useMonitorActivity, useMonitorAccounts } from '@/features/monitor/api/useMonitor';

export default function MonitorActivityPage() {
  const [filterAccountId, setFilterAccountId] = useState('');
  const { data: accounts = [] } = useMonitorAccounts();
  const { data: rows = [], isLoading, dataUpdatedAt } = useMonitorActivity(filterAccountId || undefined);

  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text">Aktivitas Live</h1>
            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">
              <Activity className="h-3 w-3 animate-pulse" />
              Auto-refresh 10s
            </span>
          </div>
          <p className="text-sm text-text-muted">
            {okCount} berhasil · {failCount} gagal · diperbarui {new Date(dataUpdatedAt).toLocaleTimeString('id-ID')}
          </p>
        </div>
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
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Memuat...</p>
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <Activity className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada aktivitas auto-join. Aktifkan monitor dan tunggu link muncul di grup.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted w-8"></th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Link Ditemukan</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden md:table-cell">Dari Grup</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted hidden lg:table-cell">Akun</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Waktu</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className={`transition-colors hover:bg-surface/50 ${row.ok ? '' : 'bg-danger/5'}`}>
                  <td className="px-4 py-2.5">
                    {row.ok ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <a
                      href={row.rawLink.startsWith('http') ? row.rawLink : `https://${row.rawLink}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-mono text-brand hover:underline truncate"
                    >
                      <span className="truncate">{row.rawLink}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted hidden md:table-cell font-mono">
                    {row.sourceGroup}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted hidden lg:table-cell">
                    {row.accountLabel ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
                    {new Date(row.joinedAt).toLocaleString('id-ID', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.alreadyMember ? (
                      <span className="flex items-center gap-1 text-text-muted">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Sudah member
                      </span>
                    ) : row.error ? (
                      <span className="text-danger">{row.error}</span>
                    ) : row.ok ? (
                      <span className="text-success">Berhasil join</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
