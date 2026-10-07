import { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { useEakTeleStock, useDeleteEakTeleStock } from '@/features/eaktele/api/useEakTeleStock';
import { StockStatusPill } from '@/features/eaktele/components/StockStatusPill';
import { AddStockDialog } from '@/features/eaktele/components/AddStockDialog';
import { useProducts } from '@/features/products/api/useProducts';
import type { EakTeleStockDto, EakTeleStockStatus } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';


const ALL = '__all__';

const statusOptions = [
  { value: ALL, label: 'Semua Status' },
  { value: 'AVAILABLE', label: 'Tersedia' },
  { value: 'NO_SESSION', label: 'Belum Login' },
  { value: 'RESERVED', label: 'Dipesan' },
  { value: 'SOLD', label: 'Terjual' },
  { value: 'INVALID', label: 'Tidak Valid' },
];

export function EakTeleStockPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>(ALL);
  const [selectedStatus, setSelectedStatus] = useState<string>(ALL);
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const products = useProducts();
  const eakTeleProducts = (products.data?.items ?? []).filter((p) => p.isEakTele);

  const params = {
    ...(selectedProduct !== ALL ? { productId: selectedProduct } : {}),
    ...(selectedStatus !== ALL ? { status: selectedStatus } : {}),
  };
  const stock = useEakTeleStock(params);
  const deleteStock = useDeleteEakTeleStock();

  const productOptions = [
    { value: ALL, label: 'Semua Produk' },
    ...eakTeleProducts.map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })),
  ];

  function handleRefresh() {
    void qc.invalidateQueries({ queryKey: queryKeys.eaktele.all });
  }

  const columns = [
    {
      key: 'productName',
      header: 'Produk',
      render: (row: EakTeleStockDto) => (
        <span className="text-sm text-text-muted max-w-[160px] truncate block">{row.productName || '—'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Nomor HP',
      render: (row: EakTeleStockDto) => (
        <span className="font-mono text-sm">{row.phone}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: EakTeleStockDto) => (
        <StockStatusPill status={row.status as EakTeleStockStatus} />
      ),
    },
    {
      key: 'isSessionActive',
      header: 'Sesi',
      render: (row: EakTeleStockDto) => (
        <span className={row.isSessionActive ? 'text-success text-sm' : 'text-text-muted text-sm'}>
          {row.isSessionActive ? 'Aktif' : 'Tidak aktif'}
        </span>
      ),
    },
    {
      key: 'otpRequestCount',
      header: 'OTP Diminta',
      render: (row: EakTeleStockDto) => (
        <span className="text-sm">{row.otpRequestCount}x</span>
      ),
    },
    {
      key: 'soldAt',
      header: 'Terjual',
      render: (row: EakTeleStockDto) =>
        row.soldAt
          ? new Date(row.soldAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
    },
    {
      key: 'notes',
      header: 'Catatan',
      render: (row: EakTeleStockDto) => (
        <span className="text-xs text-text-muted max-w-[180px] truncate block">{row.notes ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ditambahkan',
      render: (row: EakTeleStockDto) =>
        new Date(row.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
    {
      key: 'actions',
      header: '',
      render: (row: EakTeleStockDto) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={row.status === 'SOLD' || row.status === 'RESERVED'}
          onClick={() => {
            if (confirm(`Hapus akun ${row.phone}?`)) {
              void deleteStock.mutate(row.id);
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  // Summary counts
  const rows = stock.data ?? [];
  const availableCount = rows.filter((r) => r.status === 'AVAILABLE').length;
  const noSessionCount = rows.filter((r) => r.status === 'NO_SESSION').length;
  const soldCount = rows.filter((r) => r.status === 'SOLD').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stok Akun Telegram"
        description="Kelola akun Telegram yang dijual lewat bot EakTele"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah Stok
            </Button>
          </div>
        }
      />

      {/* Summary pills */}
      {stock.data && (
        <div className="flex gap-3 flex-wrap">
          <span className="text-sm text-text-muted">
            <strong className="text-success">{availableCount}</strong> tersedia •{' '}
            <strong className="text-warning">{noSessionCount}</strong> belum login •{' '}
            <strong className="text-text-muted">{soldCount}</strong> terjual •{' '}
            <strong>{rows.length}</strong> total
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          options={productOptions}
          placeholder="Pilih produk"
          className="w-56"
        />
        <Select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          options={statusOptions}
          placeholder="Filter status"
          className="w-44"
        />
      </div>

      {eakTeleProducts.length === 0 && !products.isLoading && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Belum ada produk EakTele. Buat produk baru di halaman Produk dan centang opsi &quot;Produk EakTele&quot;.
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r: EakTeleStockDto) => r.id}
        isLoading={stock.isLoading}
      />

      {addOpen && (
        <AddStockDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          defaultProductId={selectedProduct !== ALL ? selectedProduct : undefined}
        />
      )}
    </div>
  );
}
