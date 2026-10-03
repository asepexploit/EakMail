import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import type { WorkflowDto } from '@eakmail/shared-types';
import { Button, Badge, DataTable, type Column } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { strings } from '@/lib/strings';
import { formatDateTime } from '@/lib/format';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useWorkflows, useToggleWorkflowActive } from '@/features/workflows/api/useWorkflows';

/** Workflow list — entry point to the builder (DESIGN_SYSTEM.md §8, TASKS Phase 7). */
export function WorkflowsListPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useWorkflows({ pageSize: 100 });
  const toggleActive = useToggleWorkflowActive();
  // Track which row is being toggled so we can disable + show spinner on it only.
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  function handleToggle(id: string, nextActive: boolean) {
    if (pendingToggleId) return; // guard: ignore clicks while any toggle in-flight
    setPendingToggleId(id);
    toggleActive.mutate(
      { id, isActive: nextActive },
      { onSettled: () => setPendingToggleId(null) },
    );
  }

  const columns: Column<WorkflowDto>[] = [
    {
      key: 'name',
      header: featureStrings.workflows.name,
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium text-text">{row.name}</span>,
    },
    {
      key: 'version',
      header: featureStrings.workflows.version,
      align: 'right',
      render: (row) => <span className="tabular-nums">v{row.version}</span>,
    },
    {
      key: 'status',
      header: featureStrings.workflows.status,
      render: (row) => {
        const isPending = pendingToggleId === row.id;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(row.id, !row.isActive);
            }}
            disabled={isPending || Boolean(pendingToggleId)}
            aria-busy={isPending}
            aria-pressed={row.isActive}
            className="focus-ring press-feedback group inline-flex items-center gap-1.5 rounded-full outline-none transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Badge tone={row.isActive ? 'success' : 'neutral'}>
              {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {row.isActive ? strings.common.active : strings.common.inactive}
            </Badge>
          </button>
        );
      },
    },
    {
      key: 'updated',
      header: featureStrings.workflows.updated,
      align: 'right',
      sortable: true,
      sortValue: (row) => row.updatedAt,
      render: (row) => <span className="text-text-muted">{formatDateTime(row.updatedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={strings.nav.workflowBuilder}
        description={featureStrings.workflows.subtitle}
        actions={
          <Button onClick={() => navigate('/workflows/new')}>
            <Plus className="h-4 w-4" />
            {featureStrings.workflows.add}
          </Button>
        }
      />

      <QueryBoundary isLoading={isLoading} isError={isError} onRetry={refetch}>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          pageSize={20}
          onRowClick={(row) => navigate(`/workflows/${row.id}`)}
        />
      </QueryBoundary>
    </div>
  );
}
