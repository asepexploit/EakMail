import { useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import type { SupplierDto, UpsertSupplierRequest } from '@eakmail/shared-types';
import { SupplierType } from '@eakmail/shared-types';
import { Button, Badge, DataTable, ConfirmDialog, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { formatDuration, formatPercent } from '@/lib/format';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/features/suppliers/api/useSuppliers';
import { SupplierDrawer } from '@/features/suppliers/components/SupplierDrawer';
import { ApiSyncModal } from '@/features/suppliers/components/ApiSyncModal';

/** Suppliers page (DESIGN_SYSTEM.md §7.2). */
export function SuppliersPage() {
  const { data, isLoading, isError, refetch } = useSuppliers({ pageSize: 100 });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SupplierDto | null>(null);
  const [syncTarget, setSyncTarget] = useState<SupplierDto | null>(null);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(supplier: SupplierDto) {
    setEditing(supplier);
    setDrawerOpen(true);
  }

  async function handleSubmit(body: UpsertSupplierRequest) {
    if (editing) {
      await updateSupplier.mutateAsync({ id: editing.id, body });
    } else {
      await createSupplier.mutateAsync(body);
    }
    setDrawerOpen(false);
  }

  const columns: Column<SupplierDto>[] = [
    {
      key: 'name',
      header: featureStrings.suppliers.name,
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-text">{row.name}</span>
          {row.supplierType === SupplierType.API ? (
            <Badge tone="info">API</Badge>
          ) : (
            <Badge tone="neutral">Bot</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'endpoint',
      header: 'Endpoint / Bot',
      render: (row) =>
        row.supplierType === SupplierType.API ? (
          <span className="font-mono text-[12px] text-text-muted truncate max-w-[200px] block">
            {row.apiBaseUrl ?? '—'}
          </span>
        ) : (
          <span className="font-mono text-[13px] text-text-muted">@{row.botUsername}</span>
        ),
    },
    {
      key: 'successRate',
      header: featureStrings.suppliers.successRate,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.successRate ?? -1,
      render: (row) => (row.successRate === null ? '-' : formatPercent(row.successRate)),
    },
    {
      key: 'avgTime',
      header: featureStrings.suppliers.avgTime,
      align: 'right',
      render: (row) => (row.avgFulfillMs === null ? '-' : formatDuration(row.avgFulfillMs)),
    },
    {
      key: 'lastError',
      header: featureStrings.suppliers.lastError,
      render: (row) =>
        row.lastError ? (
          <Badge tone="danger">{row.lastError}</Badge>
        ) : (
          <span className="text-text-muted">{strings.common.none}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.supplierType === SupplierType.API && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSyncTarget(row);
              }}
              title="Sync & Import Produk"
              className="focus-ring rounded-sm p-1.5 text-text-muted hover:text-brand"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={strings.nav.suppliers}
        description={featureStrings.suppliers.subtitle}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {featureStrings.suppliers.add}
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          onRowClick={openEdit}
          pageSize={20}
        />
      </QueryBoundary>

      <SupplierDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        supplier={editing}
        onSubmit={handleSubmit}
        isSubmitting={createSupplier.isPending || updateSupplier.isPending}
      />

      {syncTarget && (
        <ApiSyncModal
          open={syncTarget !== null}
          onClose={() => setSyncTarget(null)}
          supplier={syncTarget}
          onImported={() => refetch()}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteSupplier.mutateAsync(pendingDelete);
          setPendingDelete(null);
        }}
        message={featureStrings.suppliers.deleteConfirm}
        isLoading={deleteSupplier.isPending}
      />
    </div>
  );
}
