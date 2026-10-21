import { useQuery } from '@tanstack/react-query';
import { CreditCard, RefreshCw } from 'lucide-react';
import { danaApi, type DanaEvent } from '@/features/dana/api/dana.api';
import { formatDateTime } from '@/lib/format';

const STATUS_STYLES = {
  ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DUPLICATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  NO_MATCH: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
} as const;

const STATUS_LABEL = {
  ACCEPTED: 'Cocok',
  DUPLICATE: 'Duplikat',
  NO_MATCH: 'Tidak Cocok',
} as const;

export function DanaEventsPage() {
  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dana-events'],
    queryFn: danaApi.listEvents,
    refetchInterval: 15_000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">DANA Events</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Notifikasi DANA yang masuk dari HP Android (200 terbaru)
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuat...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Belum ada event DANA. Pastikan Eak-DANA APK sudah terpasang dan terhubung.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Waktu</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Judul</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Isi</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nominal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {events.map((e: DanaEvent) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100 max-w-[160px] truncate" title={e.rawTitle}>
                      {e.rawTitle}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={e.rawBody}>
                      {e.rawBody}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {e.parsedAmount != null ? `Rp${e.parsedAmount.toLocaleString('id-ID')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[e.eventStatus]}`}>
                        {STATUS_LABEL[e.eventStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                      {e.orderId ? (
                        <span className="text-blue-600 dark:text-blue-400">{e.orderId.slice(0, 8)}…</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
