/**
 * StockItemsInput — manage local stock items for a product.
 * Shows a paginated table: Tersedia / Terjual with buyer info.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useToasts } from '@/features/shared/useToasts';
import { formatDateTime } from '@/lib/format';
import type { StockItemDto } from '@eakmail/shared-types';

const PAGE_SIZE = 10;

interface StockItemsInputProps {
  productId: string | null;
}

export function StockItemsInput({ productId }: StockItemsInputProps) {
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'available' | 'sold'>('all');
  const toast = useToasts();
  const client = useQueryClient();

  const stockQuery = useQuery({
    queryKey: ['stock', productId],
    queryFn: ({ signal }) => api.products.listStock(productId!, signal),
    enabled: Boolean(productId),
  });

  const addMutation = useMutation({
    mutationFn: (items: string[]) => api.products.addStock(productId!, items),
    onSuccess: (data) => {
      toast.success(`${data.added} item ditambahkan`);
      setDraft('');
      void client.invalidateQueries({ queryKey: ['stock', productId] });
    },
    onError: () => toast.error('Gagal menambah stok'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.products.clearStock(productId!),
    onSuccess: (data) => {
      toast.success(`${data.cleared} item dihapus`);
      void client.invalidateQueries({ queryKey: ['stock', productId] });
    },
    onError: () => toast.error('Gagal menghapus stok'),
  });

  function handleAdd() {
    const items = draft.split('\n').map((l) => l.trim()).filter(Boolean);
    if (items.length === 0) return;
    addMutation.mutate(items);
  }

  const allItems: StockItemDto[] = stockQuery.data?.items ?? [];
  const available = allItems.filter((i) => !i.usedAt).length;
  const sold = allItems.filter((i) => i.usedAt).length;

  const filtered = filter === 'available'
    ? allItems.filter((i) => !i.usedAt)
    : filter === 'sold'
      ? allItems.filter((i) => i.usedAt)
      : allItems;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function changeFilter(f: typeof filter) {
    setFilter(f);
    setPage(0);
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">Stok lokal</span>
        {productId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-success font-medium">{available} tersedia</span>
            <span className="text-text-muted text-xs">·</span>
            <span className="text-xs text-text-muted">{sold} terjual</span>
            {available > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearMutation.mutate()}
                isLoading={clearMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Hapus tersedia
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {productId && allItems.length > 0 && (
        <div className="flex gap-1">
          {([
            { key: 'all', label: `Semua (${allItems.length})` },
            { key: 'available', label: `Tersedia (${available})` },
            { key: 'sold', label: `Terjual (${sold})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => changeFilter(tab.key)}
              className={[
                'rounded px-2.5 py-1 text-[11px] font-medium transition',
                filter === tab.key
                  ? 'bg-brand-accent/15 text-brand-accent'
                  : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Items table */}
      {productId && allItems.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-3 py-2 text-left font-medium text-text-muted">Payload</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted w-20">Status</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Terjual ke</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted whitespace-nowrap">Terjual pada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.map((item) => (
                <tr key={item.id} className="hover:bg-surface-2/40">
                  <td className="px-3 py-2 font-mono text-[11px] text-text max-w-[180px]">
                    <span className="block truncate" title={item.payload}>{item.payload}</span>
                  </td>
                  <td className="px-3 py-2">
                    {item.usedAt ? (
                      <span className="rounded-full bg-text-muted/15 px-2 py-0.5 text-[10px] text-text-muted">Terjual</span>
                    ) : (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Tersedia</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {item.customerName ?? (item.orderId ? (
                      <span className="font-mono text-[10px]">{item.orderId.slice(0, 10)}…</span>
                    ) : '—')}
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted whitespace-nowrap">
                    {item.usedAt ? formatDateTime(item.usedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-[11px] text-text-muted">
                Hal. {safePage + 1} / {totalPages} · {filtered.length} item
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded p-1 text-text-muted disabled:opacity-30 hover:text-text transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded p-1 text-text-muted disabled:opacity-30 hover:text-text transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add stock */}
      <Textarea
        label="Tambah item (1 baris = 1 item)"
        placeholder={`email@gmail.com|password|backup|\nemail2@gmail.com|password2|backup2|`}
        value={draft}
        rows={4}
        mono
        onChange={(e) => setDraft(e.target.value)}
      />

      {!productId && (
        <p className="text-xs text-text-muted">Simpan produk dulu sebelum menambah stok.</p>
      )}

      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!productId || draft.trim() === ''}
        isLoading={addMutation.isPending}
      >
        <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
        Tambah ke stok
      </Button>
    </div>
  );
}
