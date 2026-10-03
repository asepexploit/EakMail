import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import { Button } from './Button';

export interface Column<Row> {
  /** Stable key; also used as the sort key unless `sortValue` is provided. */
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  render: (row: Row) => ReactNode;
  /** Enable client-side sorting for this column. */
  sortable?: boolean;
  /** Value used for sorting when the rendered cell is not directly comparable. */
  sortValue?: (row: Row) => string | number;
  align?: 'left' | 'right' | 'center';
  /** Render cell content in the mono font (ids, amounts, timestamps). */
  mono?: boolean;
  className?: string;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  isLoading?: boolean;
  pageSize?: number;
  /** Empty-state slot; falls back to the default localized empty state. */
  emptyState?: ReactNode;
  onRowClick?: (row: Row) => void;
  className?: string;
}

type SortDirection = 'asc' | 'desc';

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

/**
 * Sortable, paginated data table with a localized empty state
 * (DESIGN_SYSTEM.md §5, §13.6). Sorting/pagination are client-side and purely
 * presentational; data fetching stays in feature hooks.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  isLoading,
  pageSize = 10,
  emptyState,
  onRowClick,
  className,
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortable) return rows;
    const getValue = column.sortValue ?? (() => '');
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, columns, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleSort(column: Column<Row>) {
    if (!column.sortable) return;
    if (sortKey === column.key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDirection('asc');
    }
    setPage(0);
  }

  const hasRows = pageRows.length > 0;

  return (
    <div className={cn('flex flex-col rounded-md border border-border bg-surface', className)}>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'sticky top-0 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted',
                      alignClass[column.align ?? 'left'],
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="focus-ring inline-flex items-center gap-1 rounded-sm hover:text-text"
                        aria-label={
                          isSorted && sortDirection === 'asc'
                            ? strings.table.sortDescending
                            : strings.table.sortAscending
                        }
                      >
                        {column.header}
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-text-muted">
                  {strings.common.loading}
                </td>
              </tr>
            ) : hasRows ? (
              pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/60 transition-colors last:border-b-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-2 active:bg-surface-2/70',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 text-text',
                        alignClass[column.align ?? 'left'],
                        column.mono && 'font-mono text-[13px]',
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  {emptyState ?? (
                    <div className="flex flex-col items-center gap-2 text-center text-text-muted">
                      <Inbox className="h-8 w-8 opacity-60" aria-hidden />
                      <p className="text-sm font-medium text-text">{strings.table.empty}</p>
                      <p className="text-xs">{strings.table.emptyHint}</p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasRows && !isLoading && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted">
          <span>{strings.table.rowCount(sortedRows.length)}</span>
          <div className="flex items-center gap-2">
            <span>
              {strings.table.page} {currentPage + 1} {strings.table.of} {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {strings.table.previous}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              {strings.table.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
