/**
 * Modal: sync products from an API supplier.
 * Shows balance, product list, allows selecting which to import into EakMail catalog.
 */
import { useState } from 'react';
import type { ApiSupplierProduct, SupplierDto } from '@eakmail/shared-types';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Check, Package, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatRupiah, formatNumber } from '@/lib/format';

interface ApiSyncModalProps {
  open: boolean;
  onClose: () => void;
  supplier: SupplierDto;
  onImported: () => void;
}

export function ApiSyncModal({ open, onClose, supplier, onImported }: ApiSyncModalProps) {
  const [products, setProducts] = useState<ApiSupplierProduct[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [syncDone, setSyncDone] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => api.suppliers.syncProducts(supplier.id),
    onSuccess: (data) => {
      setProducts(data.products);
      setBalance(data.balance);
      setSelected(new Set());
      setSyncDone(true);
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      api.suppliers.importProducts({
        supplierId: supplier.id,
        products: products
          .filter((p) => selected.has(p.externalId))
          .map((p) => ({
            externalId: p.externalId,
            name: p.name,
            price: p.basePrice,
            description: p.description || null,
          })),
      }),
    onSuccess: () => {
      onImported();
      onClose();
    },
  });

  function toggleAll() {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.externalId)));
    }
  }

  function toggle(id: number | string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = products.length > 0 && selected.size === products.length;

  return (
    <Dialog open={open} onClose={onClose} title={`Sync Produk — ${supplier.name}`} size="lg">
      <div className="space-y-4">
        {/* Balance + sync button */}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Wallet className="h-4 w-4" />
            <span>Saldo supplier:</span>
            <span className="font-semibold text-text">
              {syncDone ? formatRupiah(balance) : '—'}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            isLoading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {syncDone ? 'Refresh' : 'Ambil Produk'}
          </Button>
        </div>

        {syncMutation.isError && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            Gagal fetch API: {String(syncMutation.error)}
          </p>
        )}

        {/* Product list */}
        {syncDone && products.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">Tidak ada produk dari supplier ini.</p>
        )}

        {syncDone && products.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {products.length} produk — {selected.size} dipilih
              </span>
              <button
                type="button"
                className="text-xs text-brand hover:underline"
                onClick={toggleAll}
              >
                {allSelected ? 'Batal semua' : 'Pilih semua'}
              </button>
            </div>

            <div className="scroll-thin max-h-72 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {products.map((p) => (
                <label
                  key={p.externalId}
                  className={`flex cursor-pointer items-start gap-2.5 rounded px-2 py-2 text-sm transition-colors ${
                    selected.has(p.externalId) ? 'bg-brand/8' : 'hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.externalId)}
                    onChange={() => toggle(p.externalId)}
                    className="mt-0.5 accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text truncate">{p.name}</span>
                      {selected.has(p.externalId) && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono">{p.category}</span>
                      <span className="font-semibold text-success">
                        {p.currency && p.currency !== 'IDR'
                          ? `${formatNumber(p.basePrice)} ${p.currency}`
                          : formatRupiah(p.basePrice)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Stok: {p.stock}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Import action */}
        {syncDone && selected.size > 0 && (
          <div className="flex items-center justify-between rounded-md bg-brand/5 px-3 py-2.5">
            <span className="text-sm text-text">
              Import <strong>{selected.size}</strong> produk ke katalog EakMail
            </span>
            <Button
              size="sm"
              isLoading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Import Sekarang
            </Button>
          </div>
        )}

        {importMutation.isError && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            Gagal import: {String(importMutation.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
