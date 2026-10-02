import { useState } from 'react';
import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import './setup.css';

/** Shared pagination for the small reference-data lists returned by Setup APIs. */
export function SetupTable<T>(props: ComponentProps<typeof DataTable<T>>) {
  const [page, setPage] = useState(0);
  const rows = props.rows ?? [];
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages - 1);
  const start = current * pageSize;
  return <div className="setup-table">
    <DataTable {...props} rows={props.loading ? null : props.rows == null ? props.rows : rows.slice(start, start + pageSize)} />
    {!props.loading && !props.error && <div className="setup-pagination">
      <p aria-live="polite">Showing {rows.length ? start + 1 : 0} to {Math.min(start + pageSize, rows.length)} of {rows.length} entries</p>
      <nav aria-label="Table pages">
        <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button>
        <span aria-current="page">{current + 1}</span>
        <button type="button" aria-label="Next page" disabled={current + 1 >= totalPages} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button>
      </nav>
    </div>}
  </div>;
}
