import { useState } from 'react';
import type { CustomerDto } from '@eakmail/shared-types';
import { Button, ConfirmDialog, DataTable, StatusPill, type Column } from '@/components/ui';
import { formatDate, formatNumber, formatRupiah } from '@/lib/format';
import { featureStrings } from '@/features/shared/feature-strings';
import { languageLabel } from '@/features/shared/enum-labels';
import { useUpdateCustomer } from '../api/useCustomers';
import { BalanceTopupModal } from './BalanceTopupModal';

export interface CustomersTableProps {
  customers: CustomerDto[];
}

/** Best-effort display name: "First Last", falling back to username, then a placeholder. */
function displayName(customer: CustomerDto): string {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (customer.username) return `@${customer.username}`;
  return featureStrings.customers.noName;
}

/**
 * Customers table with a block/unblock action per row. The confirm dialog and
 * the update mutation live here so the page stays thin; the mutation invalidates
 * the list + stats caches on success (see useUpdateCustomer).
 */
export function CustomersTable({ customers }: CustomersTableProps) {
  const copy = featureStrings.customers;
  const update = useUpdateCustomer();
  const [pending, setPending] = useState<CustomerDto | null>(null);
  const [topupTarget, setTopupTarget] = useState<CustomerDto | null>(null);

  function confirmToggle() {
    if (!pending) return;
    const nextBlocked = !pending.isBlocked;
    update.mutate(
      {
        id: pending.id,
        body: { isBlocked: nextBlocked },
        successMessage: nextBlocked ? copy.toast.blocked : copy.toast.unblocked,
      },
      { onSettled: () => setPending(null) },
    );
  }

  const columns: Column<CustomerDto>[] = [
    {
      key: 'name',
      header: copy.columns.username,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text">{displayName(row)}</span>
          {row.username && (
            <span className="text-xs text-text-muted">@{row.username}</span>
          )}
        </div>
      ),
    },
    {
      key: 'telegramId',
      header: copy.columns.telegramId,
      mono: true,
      render: (row) => row.telegramId,
    },
    {
      key: 'language',
      header: copy.columns.language,
      render: (row) => (
        <StatusPill tone="info" label={languageLabel[row.language]} />
      ),
    },
    {
      key: 'orderCount',
      header: copy.columns.orderCount,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.orderCount,
      render: (row) => <span className="tabular-nums">{formatNumber(row.orderCount)}</span>,
    },
    {
      key: 'totalSpent',
      header: copy.columns.totalSpent,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.totalSpent,
      render: (row) => <span className="tabular-nums">{formatRupiah(row.totalSpent)}</span>,
    },
    {
      key: 'balance',
      header: copy.columns.balance,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.balance,
      render: (row) => <span className="tabular-nums">{formatRupiah(row.balance)}</span>,
    },
    {
      key: 'lastOrderAt',
      header: copy.columns.lastOrderAt,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.lastOrderAt ?? '',
      render: (row) => (
        <span className="text-text-muted">
          {row.lastOrderAt ? formatDate(row.lastOrderAt) : copy.never}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: copy.columns.createdAt,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => <span className="text-text-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: copy.columns.status,
      render: (row) => (
        <StatusPill
          tone={row.isBlocked ? 'danger' : 'success'}
          label={row.isBlocked ? copy.status.blocked : copy.status.active}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTopupTarget(row)}
          >
            💰 Saldo
          </Button>
          <Button
            variant={row.isBlocked ? 'secondary' : 'danger'}
            size="sm"
            onClick={() => setPending(row)}
          >
            {row.isBlocked ? copy.actions.unblock : copy.actions.block}
          </Button>
        </div>
      ),
    },
  ];

  const isBlocking = pending !== null && !pending.isBlocked;

  return (
    <>
      <DataTable
        columns={columns}
        rows={customers}
        rowKey={(row) => row.id}
        pageSize={20}
      />

      {topupTarget && (
        <BalanceTopupModal
          customer={topupTarget}
          onClose={() => setTopupTarget(null)}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmToggle}
        isLoading={update.isPending}
        destructive={isBlocking}
        title={isBlocking ? copy.blockConfirm.title : copy.unblockConfirm.title}
        message={isBlocking ? copy.blockConfirm.message : copy.unblockConfirm.message}
        confirmLabel={
          isBlocking ? copy.blockConfirm.confirmLabel : copy.unblockConfirm.confirmLabel
        }
      />
    </>
  );
}
