import type { ReactNode } from 'react';
import { EmptyState, ErrorState, Spinner } from './ui';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/** A responsive table with loading, error and empty states. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  error,
  onRetry,
  empty = 'Nothing to show',
  emptyHint,
  onRowClick,
}: {
  rows: T[] | null | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: string;
  emptyHint?: string;
  onRowClick?: (row: T) => void;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState title={empty} description={emptyHint} />;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'cursor-pointer' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.header} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
