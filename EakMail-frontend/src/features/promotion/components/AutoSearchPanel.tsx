/**
 * Auto-search panel — displayed at the top of Promotion Accounts page.
 * Shows keyword management + queue stats + queue items.
 */
import { useState } from 'react';
import {
  Search, Plus, X, ChevronDown, ChevronUp, Loader2, Trash2,
  CheckCircle2, XCircle, Clock, SkipForward, LogIn,
} from 'lucide-react';
import {
  useAutoSearchKeywords,
  useAddKeyword,
  useRemoveKeyword,
  useQueueStats,
  useQueueItems,
  useClearQueue,
} from '../api/useAutoSearch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PENDING: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Menunggu', color: 'text-text-muted' },
  JOINING: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Joining...', color: 'text-brand' },
  JOINED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Joined', color: 'text-success' },
  LEFT: { icon: <LogIn className="h-3.5 w-3.5" />, label: 'Left', color: 'text-warning' },
  FAILED: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Gagal', color: 'text-danger' },
  SKIPPED: { icon: <SkipForward className="h-3.5 w-3.5" />, label: 'Dilewati', color: 'text-text-muted' },
};

export function AutoSearchPanel() {
  const [open, setOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [queueFilter, setQueueFilter] = useState<string>('');

  const { data: keywords = [], isLoading: kwLoading } = useAutoSearchKeywords();
  const { data: stats } = useQueueStats();
  const { data: queueItems = [] } = useQueueItems(queueFilter || undefined);
  const addKw = useAddKeyword();
  const removeKw = useRemoveKeyword();
  const clearQ = useClearQueue();

  const enabledCount = keywords.filter((k) => k.enabled).length;

  function handleAddKeyword() {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    addKw.mutate(kw);
    setNewKeyword('');
  }

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
            <Search className="h-4 w-4 text-brand" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-text">Auto-Search & Join Grup</p>
            <p className="text-xs text-text-muted">
              Cari grup Telegram otomatis setiap 3 jam, join pelan-pelan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <StatBadge label="Antrian" value={stats.pending} color="bg-brand/10 text-brand" />
              <StatBadge label="Joined" value={stats.joined} color="bg-success/10 text-success" />
              <StatBadge label="Gagal" value={stats.failed + stats.left} color="bg-danger/10 text-danger" />
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Stats bar */}
          {stats && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border">
              <StatCell label="Antrian" value={stats.pending} />
              <StatCell label="Joining" value={stats.joining} />
              <StatCell label="Joined" value={stats.joined} />
              <StatCell label="Left" value={stats.left} />
              <StatCell label="Gagal" value={stats.failed} />
              <StatCell label="Skip" value={stats.skipped} />
            </div>
          )}

          {/* Keywords section */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-text">
                Keywords ({enabledCount} aktif / {keywords.length} total)
              </p>
            </div>

            {/* Add keyword */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                placeholder="Tambah keyword baru..."
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <Button
                size="sm"
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim() || addKw.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Keyword tags */}
            {kwLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Memuat...
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {keywords.map((kw) => (
                  <span
                    key={kw.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      kw.enabled
                        ? 'bg-brand/10 text-brand'
                        : 'bg-surface text-text-muted line-through'
                    }`}
                  >
                    {kw.keyword}
                    <button
                      type="button"
                      onClick={() => removeKw.mutate(kw.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-danger/20 hover:text-danger"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Queue section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-text">Antrian Join</p>
              <div className="flex items-center gap-2">
                <select
                  value={queueFilter}
                  onChange={(e) => setQueueFilter(e.target.value)}
                  className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-text focus:outline-none"
                >
                  <option value="">Semua</option>
                  <option value="PENDING">Menunggu</option>
                  <option value="JOINING">Joining</option>
                  <option value="JOINED">Joined</option>
                  <option value="LEFT">Left</option>
                  <option value="FAILED">Gagal</option>
                  <option value="SKIPPED">Dilewati</option>
                </select>
                {stats && (stats.joined + stats.failed + stats.left + stats.skipped) > 0 && (
                  <button
                    type="button"
                    onClick={() => clearQ.mutate(undefined)}
                    disabled={clearQ.isPending}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Bersihkan
                  </button>
                )}
              </div>
            </div>

            {queueItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">
                Belum ada grup dalam antrian. Tunggu search cycle berikutnya (setiap 3 jam).
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead className="bg-surface-hover text-text-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Grup</th>
                      <th className="px-3 py-2 text-left hidden sm:table-cell">Keyword</th>
                      <th className="px-3 py-2 text-left hidden md:table-cell">Member</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {queueItems.map((item) => {
                      const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
                      return (
                        <tr key={item.id} className="hover:bg-surface-hover/50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-text truncate max-w-[200px]">{item.title}</div>
                            {item.username && (
                              <div className="text-text-muted">@{item.username}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-muted hidden sm:table-cell">{item.keyword}</td>
                          <td className="px-3 py-2 text-text-muted hidden md:table-cell">
                            {item.memberCount?.toLocaleString('id-ID') ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className={`flex items-center gap-1 ${cfg.color}`}>
                              {cfg.icon}
                              <span>{cfg.label}</span>
                            </div>
                            {item.error && (
                              <div className="text-danger truncate max-w-[150px]" title={item.error}>
                                {item.error}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${color}`}>
      {value} {label}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-bg px-3 py-2">
      <span className="text-sm font-bold text-text">{value}</span>
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}
