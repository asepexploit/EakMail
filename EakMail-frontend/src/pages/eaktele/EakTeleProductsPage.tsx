import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useProducts, useCreateProduct, useDeleteProduct, useSetProductActive } from '@/features/products/api/useProducts';
import { StockMode } from '@eakmail/shared-types';
import type { ProductDto } from '@eakmail/shared-types';

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function EakTeleProductsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const products = useProducts({ pageSize: 100 });
  const eakTeleProducts = (products.data?.items ?? []).filter((p) => p.isEakTele);

  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const setActive = useSetProductActive();

  async function handleCreate() {
    if (!name.trim() || !price) return;
    await createProduct.mutateAsync({
      name: name.trim(),
      price: Number(price),
      stockMode: StockMode.MANUAL,
      stock: 0,
      active: true,
      isEakTele: true,
    });
    setName(''); setPrice('');
    setAddOpen(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produk EakTele"
        description="Produk khusus bot EakTele — akun Telegram yang dijual ke pelanggan"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Buat Produk
          </Button>
        }
      />

      {products.isLoading && (
        <p className="text-sm text-text-muted">Memuat...</p>
      )}

      {!products.isLoading && eakTeleProducts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-text">Belum ada produk EakTele</p>
          <p className="mt-1 text-xs text-text-muted">Buat produk dulu, lalu tambah stok akun di menu Stok Akun Telegram</p>
          <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Buat Produk Pertama
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {eakTeleProducts.map((p: ProductDto) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text">{p.name}</p>
                <p className="text-lg font-semibold text-brand mt-0.5">{formatRupiah(p.price)}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => void setActive.mutate({ id: p.id, active: e.target.checked })}
                  className="accent-brand"
                />
                Aktif
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Hapus produk "${p.name}"?`)) {
                    void deleteProduct.mutate(p);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setName(''); setPrice(''); }}
        title="Buat Produk EakTele"
        size="sm"
        footer={
          <Button
            onClick={handleCreate}
            isLoading={createProduct.isPending}
            disabled={!name.trim() || !price}
          >
            Buat
          </Button>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nama produk"
            placeholder="Contoh: Akun Telegram Aged 2021"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Harga (Rupiah)"
            type="number"
            min={0}
            placeholder="50000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Produk ini otomatis dikategorikan sebagai EakTele dan hanya muncul di bot EakTele, bukan storefront biasa.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
