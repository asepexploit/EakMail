import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { StockMode, type ProductDto, type UpsertProductRequest } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Drawer } from '@/components/ui';
import { strings } from '@/lib/strings';
import { featureStrings } from '@/features/shared/feature-strings';
import { useSuppliers } from '@/features/suppliers/api/useSuppliers';
import { useWorkflows } from '@/features/workflows/api/useWorkflows';
import { StockItemsInput } from './StockItemsInput';

export interface ProductDrawerProps {
  open: boolean;
  onClose: () => void;
  product: ProductDto | null;
  onSubmit: (body: UpsertProductRequest) => void;
  isSubmitting: boolean;
}

interface OptionRow {
  key: string;
  value: string;
  price: number;
}

/** Local form state — a fully-populated variant of the request with concrete options. */
interface ProductFormState {
  name: string;
  price: number;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  supplierId: string | null;
  workflowId: string | null;
  stockMode: StockMode;
  stock: number;
  active: boolean;
  externalProductId: string | null;
  options: OptionRow[];
}

function toForm(product: ProductDto | null): ProductFormState {
  if (!product) {
    return {
      name: '',
      price: 0,
      sku: null,
      description: null,
      imageUrl: null,
      supplierId: null,
      workflowId: null,
      stockMode: StockMode.MANUAL,
      stock: 0,
      active: true,
      externalProductId: null,
      options: [],
    };
  }
  return {
    name: product.name,
    price: product.price,
    sku: product.sku,
    description: product.description,
    imageUrl: product.imageUrl,
    supplierId: product.supplierId,
    workflowId: product.workflowId,
    stockMode: product.stockMode,
    stock: product.stock,
    active: product.active,
    externalProductId: product.externalProductId,
    options: product.options.map((o) => ({ key: o.key, value: o.value, price: o.price })),
  };
}

/** Create/edit product form with options editor (DESIGN_SYSTEM.md §7.4, F6). */
export function ProductDrawer({ open, onClose, product, onSubmit, isSubmitting }: ProductDrawerProps) {
  const [form, setForm] = useState(toForm(null));
  const suppliersQuery = useSuppliers({ pageSize: 100 });
  const workflowsQuery = useWorkflows({ pageSize: 100 });

  useEffect(() => {
    if (open) setForm(toForm(product));
  }, [open, product]);

  const stockModeOptions = [
    { value: StockMode.API_SUPPLIER,            label: '🌐 API Supplier (langsung ke REST API)' },
    { value: StockMode.STOCK_WITH_API_FALLBACK, label: '📦 Stok sendiri → fallback API Supplier' },
    { value: StockMode.WORKFLOW,                label: '🤖 Workflow supplier (bot Telegram)' },
    { value: StockMode.STOCK_ONLY,              label: '📦 Stok sendiri (habis = gagal)' },
    { value: StockMode.STOCK_WITH_FALLBACK,     label: '📦 Stok sendiri → fallback workflow' },
    { value: StockMode.MANUAL,                  label: featureStrings.products.stockModeManual },
    { value: StockMode.UNLIMITED,               label: featureStrings.products.stockModeUnlimited },
  ];

  const supplierOptions = [
    { value: '', label: featureStrings.products.noSupplier },
    ...(suppliersQuery.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];
  const workflowOptions = [
    { value: '', label: featureStrings.products.noWorkflow },
    ...(workflowsQuery.data?.items ?? []).map((w) => ({ value: w.id, label: w.name })),
  ];

  function updateOption(index: number, patch: Partial<OptionRow>) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  const canSubmit = form.name.trim() !== '' && form.price >= 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={product ? featureStrings.products.edit : featureStrings.products.add}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {strings.actions.cancel}
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                ...form,
                sku: form.sku || null,
                description: form.description || null,
                imageUrl: form.imageUrl || null,
                supplierId: form.supplierId || null,
                workflowId: form.workflowId || null,
                externalProductId: form.externalProductId || null,
              })
            }
            isLoading={isSubmitting}
            disabled={!canSubmit}
          >
            {strings.actions.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={featureStrings.products.name}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={featureStrings.products.price}
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
          />
          <Input
            label={featureStrings.products.sku}
            value={form.sku ?? ''}
            mono
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
          />
        </div>
        <Select
          label={featureStrings.products.stockMode}
          options={stockModeOptions}
          value={form.stockMode}
          onChange={(e) => setForm((prev) => ({ ...prev, stockMode: e.target.value as ProductDto['stockMode'] }))}
        />
        {form.stockMode !== StockMode.UNLIMITED && (
          <>
            <Input
              label={featureStrings.products.stock}
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
            />
            <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              {form.stockMode === StockMode.MANUAL
                ? 'Stock = 0 → produk tampil "Habis" di katalog dan tidak bisa dibeli.'
                : 'Stock = 0 → produk tampil "Habis". Isi angka untuk aktifkan tracking — otomatis berkurang setelah tiap delivery berhasil.'}
            </p>
          </>
        )}
        {(form.stockMode === StockMode.STOCK_ONLY || form.stockMode === StockMode.STOCK_WITH_FALLBACK) && (
          <StockItemsInput productId={product?.id ?? null} />
        )}
        {(form.stockMode === StockMode.API_SUPPLIER || form.stockMode === StockMode.STOCK_WITH_API_FALLBACK) && (
          <p className="rounded-md bg-info/10 px-3 py-2 text-xs text-info">
            {form.stockMode === StockMode.STOCK_WITH_API_FALLBACK
              ? <>Stok lokal dipakai duluan. Kalau habis, otomatis fallback ke <strong>API Supplier</strong>. Butuh supplier API + External Product ID.</>
              : <>Mode ini membutuhkan <strong>Supplier tipe API</strong> + <strong>External Product ID</strong>. Stok dicek langsung dari API sebelum order.</>
            }
          </p>
        )}
        <Textarea
          label={featureStrings.products.description}
          value={form.description ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />
        <Input
          label={featureStrings.products.imageUrl}
          value={form.imageUrl ?? ''}
          mono
          onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={featureStrings.products.supplier}
            options={supplierOptions}
            value={form.supplierId ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value || null }))}
          />
          <Select
            label={featureStrings.products.workflow}
            options={workflowOptions}
            value={form.workflowId ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, workflowId: e.target.value || null }))}
          />
        </div>
        {(form.stockMode === StockMode.API_SUPPLIER || form.stockMode === StockMode.STOCK_WITH_API_FALLBACK) && (
          <Input
            label="External Product ID (ID produk di sisi supplier API)"
            value={form.externalProductId ?? ''}
            mono
            placeholder="15"
            onChange={(e) => setForm((prev) => ({ ...prev, externalProductId: e.target.value || null }))}
          />
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            className="accent-brand"
          />
          {featureStrings.products.active}
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">
              {featureStrings.products.options}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  options: [...prev.options, { key: '', value: '', price: 0 }],
                }))
              }
            >
              <Plus className="h-3.5 w-3.5" />
              {featureStrings.products.addOption}
            </Button>
          </div>
          {form.options.map((option, index) => (
            <div key={index} className="flex items-end gap-2">
              <Input
                label={index === 0 ? featureStrings.products.optionKey : undefined}
                value={option.key}
                onChange={(e) => updateOption(index, { key: e.target.value })}
              />
              <Input
                label={index === 0 ? featureStrings.products.optionValue : undefined}
                value={option.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
              />
              <Input
                label={index === 0 ? featureStrings.products.optionPrice : undefined}
                type="number"
                value={option.price}
                onChange={(e) => updateOption(index, { price: Number(e.target.value) })}
              />
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    options: prev.options.filter((_, i) => i !== index),
                  }))
                }
                aria-label={strings.actions.delete}
                className="focus-ring mb-1 rounded-sm p-2 text-text-muted hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
