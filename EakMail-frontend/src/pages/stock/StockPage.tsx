/**
 * Halaman Manajemen Stok — monitor stok lokal semua produk.
 * Per produk: stat chips, progress bar, tabel item (dengan payload), input tambah stok.
 * Template pesan pengiriman diakses via tombol → modal (tidak inline).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PackagePlus, Trash2, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle2, Clock, Package, FileText, Save, X,
} from 'lucide-react';
import { StockMode } from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { useToasts } from '@/features/shared/useToasts';
import { cn } from '@/lib/cn';

// ---- delivery template presets -----------------------------------------------

const DELIVERY_PRESETS = [
  { label: '1 · Minimalis', body: '{{payload}}' },
  { label: '2 · Simpel',    body: '✅ Pesananmu sudah dikirim!\n\n{{payload}}\n\n🆔 `{{orderId}}`' },
  { label: '3 · Standard',  body: '🎉 *Pesanan Berhasil Dikirim!*\n\n📦 Berikut produkmu:\n\n{{payload}}\n\n──────────────\n🆔 `{{orderId}}`\nSimpan sebagai bukti ya!' },
  { label: '4 · Casual',    body: 'Hei! Produkmu udah siap nih 🚀\n\n{{payload}}\n\n🆔 `{{orderId}}` · Terima kasih! ❤️' },
  { label: '5 · Lengkap',   body: '🎉 *Pesanan Berhasil Dikirim!*\n\nHei! Produk digitalmu sudah siap nih 🚀\n\n📦 *Berikut produkmu:*\n\n{{payload}}\n\n──────────────────────\n🆔 ID Pesanan: `{{orderId}}`\nSimpan pesan ini sebagai bukti ya!\n──────────────────────\n\nTerima kasih sudah belanja! ❤️' },
];

// ---- helpers ----------------------------------------------------------------

function stockModeLabel(mode: string) {
  if (mode === StockMode.STOCK_ONLY) return 'Stok sendiri';
  if (mode === StockMode.STOCK_WITH_FALLBACK) return 'Stok → Workflow';
  if (mode === StockMode.STOCK_WITH_API_FALLBACK) return 'Stok → API';
  if (mode === StockMode.API_SUPPLIER) return 'API Supplier';
  return mode;
}

function stockModeTone(mode: string): 'info' | 'warning' | 'success' {
  if (mode === StockMode.API_SUPPLIER) return 'success';
  if (mode === StockMode.STOCK_WITH_API_FALLBACK) return 'success';
  return mode === StockMode.STOCK_ONLY ? 'info' : 'warning';
}

function hasLocalStock(mode: string): boolean {
  return (
    mode === StockMode.STOCK_ONLY ||
    mode === StockMode.STOCK_WITH_FALLBACK ||
    mode === StockMode.STOCK_WITH_API_FALLBACK
  );
}

function isApiOnly(mode: string): boolean {
  return mode === StockMode.API_SUPPLIER;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---- StockBar ---------------------------------------------------------------

function StockBar({ available, total }: { available: number; total: number }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const color = available === 0 ? 'bg-danger' : available <= 3 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-text-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

// ---- TemplateModal ----------------------------------------------------------

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  deliveryTemplate: string | null;
}

function TemplateModal({ open, onClose, productId, deliveryTemplate }: TemplateModalProps) {
  const [draft, setDraft] = useState(deliveryTemplate ?? '');
  const toast = useToasts();
  const client = useQueryClient();

  // Reset draft whenever the modal opens (picks up latest saved value)
  useEffect(() => {
    if (open) setDraft(deliveryTemplate ?? '');
  }, [open, deliveryTemplate]);

  const templateMutation = useMutation({
    mutationFn: (template: string | null) =>
      api.products.updateDeliveryTemplate(productId, template),
    onSuccess: () => {
      toast.success('Template pesan disimpan');
      void client.invalidateQueries({ queryKey: ['products-all'] });
      onClose();
    },
    onError: () => toast.error('Gagal menyimpan template'),
  });

  function handleSave() {
    templateMutation.mutate(draft || null);
  }

  function handleClear() {
    setDraft('');
    templateMutation.mutate(null);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Template Pesan Pengiriman"
      description="Jika diisi, pesan ini menggantikan seluruh notifikasi pengiriman default."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={templateMutation.isPending}>
            Batal
          </Button>
          {draft && (
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={templateMutation.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Hapus template
            </Button>
          )}
          <Button onClick={handleSave} isLoading={templateMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-text-muted">
          Variabel:{' '}
          <code className="bg-surface-2 px-1 rounded text-[11px]">{'{{payload}}'}</code>{' '}
          <code className="bg-surface-2 px-1 rounded text-[11px]">{'{{orderId}}'}</code>{' '}
          <code className="bg-surface-2 px-1 rounded text-[11px]">{'{{quantity}}'}</code>
        </p>
        {/* Preset picker */}
        <div className="flex flex-wrap gap-1.5">
          {DELIVERY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDraft(p.body)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                draft === p.body
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-border text-text-muted hover:border-brand-accent/50 hover:text-text',
              )}
            >
              {p.label}
            </button>
          ))}
          {draft && !DELIVERY_PRESETS.some((p) => p.body === draft) && (
            <span className="rounded-md border border-dashed border-brand-accent px-2.5 py-1 text-[11px] text-brand-accent">
              ✏️ Custom
            </span>
          )}
        </div>
        <Textarea
          label="Template pesan (kosongkan = pakai notifikasi default sistem)"
          placeholder="Pilih preset di atas atau ketik template sendiri…"
          value={draft}
          rows={6}
          mono
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

// ---- ProductStockPanel ------------------------------------------------------

type StockItem = {
  id: string;
  payload: string;
  usedAt: string | null;
  orderId: string | null;
  createdAt: string;
};

interface ProductStockPanelProps {
  productId: string;
  productName: string;
  stockMode: string;
  deliveryTemplate: string | null;
}

function ProductStockPanel({ productId, productName, stockMode, deliveryTemplate }: ProductStockPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'available' | 'sold'>('available');
  const [templateOpen, setTemplateOpen] = useState(false);
  const isApiOnlyMode = isApiOnly(stockMode);
  const toast = useToasts();
  const client = useQueryClient();

  const stockQuery = useQuery({
    queryKey: ['stock', productId],
    queryFn: ({ signal }) => api.products.listStock(productId, signal),
  });

  const addMutation = useMutation({
    mutationFn: (items: string[]) => api.products.addStock(productId, items),
    onSuccess: (data) => {
      toast.success(`${data.added} item ditambahkan`);
      setDraft('');
      void client.invalidateQueries({ queryKey: ['stock', productId] });
    },
    onError: () => toast.error('Gagal menambah stok'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.products.clearStock(productId),
    onSuccess: (data) => {
      toast.success(`${data.cleared} item dihapus`);
      void client.invalidateQueries({ queryKey: ['stock', productId] });
    },
    onError: () => toast.error('Gagal hapus stok'),
  });

  const items: StockItem[] = stockQuery.data?.items ?? [];
  const available = stockQuery.data?.available ?? 0;
  const total = items.length;
  const sold = total - available;

  const availableItems = items.filter((i) => !i.usedAt);
  const soldItems = items.filter((i) => i.usedAt);
  const displayItems = tab === 'available' ? availableItems : soldItems;

  function handleAdd() {
    const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    addMutation.mutate(lines);
  }

  const stockColor = available === 0 ? 'text-danger' : available <= 3 ? 'text-warning' : 'text-success';
  const hasTemplate = Boolean(deliveryTemplate);

  return (
    <>
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-sm">
        {/* ---- Header (always visible) ---- */}
        <button
          type="button"
          className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-surface-2/50 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {/* icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/10">
            <Package className="h-4 w-4 text-brand" />
          </div>

          {/* name + mode + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text truncate">{productName}</span>
              <Badge tone={stockModeTone(stockMode)}>{stockModeLabel(stockMode)}</Badge>
            </div>
            {!isApiOnlyMode && (
              <div className="mt-1.5 max-w-xs">
                <StockBar available={available} total={total} />
              </div>
            )}
            {isApiOnlyMode && (
              <p className="mt-1 text-xs text-text-muted">Stok dikelola oleh supplier eksternal</p>
            )}
          </div>

          {/* right side: stats + template button + chevron */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Stock stats chips — local stock modes only */}
            {!isApiOnlyMode && (
              <div className="flex items-center gap-2 text-xs">
                <span className={cn('font-semibold tabular-nums', stockColor)}>
                  Tersedia ({available})
                </span>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted tabular-nums">Terjual ({sold})</span>
              </div>
            )}

            {/* Template button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTemplateOpen(true); }}
              title={hasTemplate ? 'Template aktif — klik untuk edit' : 'Atur template pesan pengiriman'}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition',
                hasTemplate
                  ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                  : 'border-border text-text-muted hover:border-brand-accent/40 hover:text-text',
              )}
            >
              <FileText className="h-3 w-3" />
              Template
              {hasTemplate && <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />}
            </button>

            {/* Chevron */}
            <div className="text-text-muted">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </button>

        {/* ---- Expanded body ---- */}
        {expanded && (
          <div className="border-t border-border">
            {/* Info banners */}
            {isApiOnlyMode && (
              <div className="px-5 py-3">
                <p className="rounded-md bg-info/10 px-3 py-2 text-xs text-info">
                  Stok dikelola otomatis oleh API supplier. Setiap order dikirim langsung ke API — tidak ada stok lokal yang perlu diisi.
                </p>
              </div>
            )}
            {stockMode === StockMode.STOCK_WITH_API_FALLBACK && (
              <div className="px-5 pt-3">
                <p className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                  Mode hybrid: stok lokal digunakan duluan. Kalau habis, otomatis fallback ke API Supplier.
                </p>
              </div>
            )}

            {/* Tabs + Item table — local stock only */}
            {!isApiOnlyMode && (
              <>
                <div className="flex border-b border-border px-5">
                  <button
                    type="button"
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                      tab === 'available'
                        ? 'border-brand text-brand'
                        : 'border-transparent text-text-muted hover:text-text',
                    )}
                    onClick={() => setTab('available')}
                  >
                    Tersedia ({availableItems.length})
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                      tab === 'sold'
                        ? 'border-brand text-brand'
                        : 'border-transparent text-text-muted hover:text-text',
                    )}
                    onClick={() => setTab('sold')}
                  >
                    Terjual ({soldItems.length})
                  </button>
                </div>

                <div className="px-5 py-3">
                  {stockQuery.isPending ? (
                    <div className="text-sm text-text-muted py-4 text-center">Memuat...</div>
                  ) : displayItems.length === 0 ? (
                    <div className="text-sm text-text-muted py-6 text-center">
                      {tab === 'available' ? 'Tidak ada stok tersedia.' : 'Belum ada yang terjual.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-2">
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">#</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Payload</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Ditambah</th>
                            {tab === 'sold' && (
                              <>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Terjual</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Pembeli</th>
                              </>
                            )}
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {displayItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-surface-2/40 transition-colors">
                              <td className="px-3 py-2 text-text-muted tabular-nums">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono text-xs text-text max-w-md">
                                <span className="break-all">{item.payload}</span>
                              </td>
                              <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                              {tab === 'sold' && (
                                <>
                                  <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">
                                    {item.usedAt ? fmtDate(item.usedAt) : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    {item.customerName ? (
                                      <span className="font-medium text-text">{item.customerName}</span>
                                    ) : (
                                      <span className="text-text-muted">—</span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="px-3 py-2">
                                {item.usedAt ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-danger font-medium">
                                    <CheckCircle2 className="h-3 w-3" /> Terjual
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                                    <Clock className="h-3 w-3" /> Tersedia
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Add stock — local stock only */}
            {hasLocalStock(stockMode) && (
              <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Tambah stok baru</p>
                <Textarea
                  label="Paste item (1 baris = 1 item)"
                  placeholder={`email@gmail.com|password|backup|\nemail2@gmail.com|password2|backup2|`}
                  value={draft}
                  rows={4}
                  mono
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!draft.trim()}
                    isLoading={addMutation.isPending}
                  >
                    <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                    Tambah ke stok
                  </Button>
                  {available > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => clearMutation.mutate()}
                      isLoading={clearMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Hapus stok tersisa
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template modal — rendered outside the card so click propagation is clean */}
      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        productId={productId}
        deliveryTemplate={deliveryTemplate}
      />
    </>
  );
}

// ---- main page --------------------------------------------------------------

export function StockPage() {
  const client = useQueryClient();
  const toast = useToasts();

  const productsQuery = useQuery({
    queryKey: ['products-all'],
    queryFn: ({ signal }) => api.products.list({ pageSize: 200 }, signal),
  });

  const stockProducts = (productsQuery.data?.items ?? []).filter(
    (p) =>
      p.stockMode === StockMode.STOCK_ONLY ||
      p.stockMode === StockMode.STOCK_WITH_FALLBACK ||
      p.stockMode === StockMode.STOCK_WITH_API_FALLBACK ||
      p.stockMode === StockMode.API_SUPPLIER,
  );

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Manajemen Stok</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Kelola stok lokal semua produk — {stockProducts.length} produk
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void client.invalidateQueries({ queryKey: ['products-all'] });
            void client.invalidateQueries({ queryKey: ['stock'] });
            toast.success('Data diperbarui');
          }}
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Muat Ulang
        </Button>
      </div>

      {/* Loading */}
      {productsQuery.isPending && (
        <div className="text-sm text-text-muted">Memuat produk...</div>
      )}

      {/* Empty state */}
      {!productsQuery.isPending && stockProducts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-surface-2 mb-4">
            <Package className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text">Belum ada produk yang dikelola di sini</p>
          <p className="text-xs text-text-muted mt-1.5 max-w-xs mx-auto">
            Ubah mode stok produk ke "Stok sendiri", "Stok + fallback", atau "API Supplier" di halaman Produk.
          </p>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-3">
        {stockProducts.map((product) => (
          <ProductStockPanel
            key={product.id}
            productId={product.id}
            productName={product.name}
            stockMode={product.stockMode}
            deliveryTemplate={product.deliveryTemplate}
          />
        ))}
      </div>
    </div>
  );
}
