import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { StockMode, type ProductDto, type UpsertProductRequest } from '@eakmail/shared-types';
import { Button, Badge, DataTable, ConfirmDialog, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useSetProductActive,
  useUpdateProduct,
} from '@/features/products/api/useProducts';
import { ProductDrawer } from '@/features/products/components/ProductDrawer';
import { InlinePriceEdit } from '@/features/products/components/InlinePriceEdit';

/** Products (Produk) page — CRUD + inline price edit + options (DESIGN_SYSTEM.md §7.4). */
export function ProductsPage() {
  const { data, isLoading, isError, refetch } = useProducts({ pageSize: 100 });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const setActive = useSetProductActive();
  const deleteProduct = useDeleteProduct();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null);

  async function handleSubmit(body: UpsertProductRequest) {
    if (editing) await updateProduct.mutateAsync({ id: editing.id, body });
    else await createProduct.mutateAsync(body);
    setDrawerOpen(false);
  }

  function toRequest(product: ProductDto, patch: Partial<UpsertProductRequest>): UpsertProductRequest {
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
      options: product.options.map((o) => ({
        key: o.key,
        value: o.value,
        price: o.price,
      })),
      ...patch,
    };
  }

  const columns: Column<ProductDto>[] = [
    {
      key: 'name',
      header: featureStrings.products.name,
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div>
          <p className="font-medium text-text">{row.name}</p>
          {row.sku && <p className="font-mono text-xs text-text-muted">{row.sku}</p>}
        </div>
      ),
    },
    {
      key: 'price',
      header: featureStrings.products.price,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.price,
      render: (row) => (
        <InlinePriceEdit
          price={row.price}
          onSave={async (price) => {
            await updateProduct.mutateAsync({ id: row.id, body: toRequest(row, { price }) });
          }}
        />
      ),
    },
    {
      key: 'stock',
      header: featureStrings.products.stock,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.stock,
      render: (row) => (
        <span className="tabular-nums">
          {row.stockMode === StockMode.MANUAL ? row.stock : '∞'}
        </span>
      ),
    },
    {
      key: 'options',
      header: featureStrings.products.options,
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.options.length}</span>,
    },
    {
      key: 'active',
      header: featureStrings.products.active,
      align: 'center',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void setActive.mutate({ id: row.id, active: !row.active });
          }}
        >
          <Badge tone={row.active ? 'success' : 'neutral'}>
            {row.active ? strings.common.active : strings.common.inactive}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete(row);
          }}
          aria-label={strings.actions.delete}
          className="focus-ring rounded-sm p-1 text-text-muted hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={strings.nav.products}
        description={featureStrings.products.subtitle}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {featureStrings.products.add}
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          pageSize={20}
          onRowClick={(row) => {
            setEditing(row);
            setDrawerOpen(true);
          }}
        />
      </QueryBoundary>

      <ProductDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={editing}
        onSubmit={handleSubmit}
        isSubmitting={createProduct.isPending || updateProduct.isPending}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteProduct.mutateAsync(pendingDelete);
          setPendingDelete(null);
        }}
        message={featureStrings.products.deleteConfirm}
        isLoading={deleteProduct.isPending}
      />
    </div>
  );
}
