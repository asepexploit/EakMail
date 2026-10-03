import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, SkipForward, RefreshCw } from 'lucide-react';
import { PromotionLogStatus } from '@eakmail/shared-types';
import { usePromotionLogs } from '@/features/promotion/api/usePromotionLogs';
import { usePromotionCampaigns } from '@/features/promotion/api/usePromotionCampaigns';
import { Button } from '@/components/ui/Button';
import { strings } from '@/lib/strings';

const STATUS_ICON: Record<string, JSX.Element> = {
  [PromotionLogStatus.SENT]: <CheckCircle2 className="h-4 w-4 text-success" />,
  [PromotionLogStatus.FAILED]: <XCircle className="h-4 w-4 text-danger" />,
  [PromotionLogStatus.FLOOD_WAIT]: <Clock className="h-4 w-4 text-warning" />,
  [PromotionLogStatus.SKIPPED]: <SkipForward className="h-4 w-4 text-text-muted" />,
};

const STATUS_LABEL: Record<string, string> = {
  [PromotionLogStatus.SENT]: 'Terkirim',
  [PromotionLogStatus.FAILED]: 'Gagal',
  [PromotionLogStatus.FLOOD_WAIT]: 'Flood Wait',
  [PromotionLogStatus.SKIPPED]: 'Dilewati',
};

export default function PromotionLogsPage() {
  const [campaignId, setCampaignId] = useState<string>('');
  const { data: logs = [], isLoading, refetch } = usePromotionLogs(campaignId || undefined);
  const { data: campaigns = [] } = usePromotionCampaigns();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Riwayat Kirim</h1>
          <p className="text-sm text-text-muted">Log pengiriman pesan promosi per kampanye</p>
        </div>
        <Button variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Muat Ulang
        </Button>
      </div>

      <div className="flex gap-3">
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">Semua Kampanye</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">{strings.common.loading}</p>
      ) : logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">Belum ada riwayat kirim.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Kampanye</th>
                <th className="px-4 py-3 text-left">Akun</th>
                <th className="px-4 py-3 text-left">Target Grup</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover/50">
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                    {new Date(log.sentAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 font-medium text-text">{log.campaignName}</td>
                  <td className="px-4 py-3 text-text-muted">{log.accountLabel ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text">{log.targetGroup}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[log.status]}
                      <span>{STATUS_LABEL[log.status]}</span>
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-danger">
                    {log.errorMessage ?? '—'}
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
