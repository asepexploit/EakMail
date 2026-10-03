/**
 * StockItemsInput — manage local stock items for a product.
 * Shows current available count + textarea to paste and add new items (one per line).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useToasts } from '@/features/shared/useToasts';

interface StockItemsInputProps {
  productId: string | null;
}

export function StockItemsInput({ productId }: StockItemsInputProps) {
  const [draft, setDraft] = useState('');
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

  const available = stockQuery.data?.available ?? 0;
  const total = stockQuery.data?.total ?? 0;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          Stok lokal
          {productId && (
            <span className="ml-2 text-xs text-text-muted">
              {available} tersedia / {total} total
            </span>
          )}
        </span>
        {productId && available > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMutation.mutate()}
            isLoading={clearMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Hapus semua
          </Button>
        )}
      </div>

      <Textarea
        label="Tambah item (1 baris = 1 item)"
        placeholder={`email@gmail.com|password|backup|\nemail2@gmail.com|password2|backup2|`}
        value={draft}
        rows={5}
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
