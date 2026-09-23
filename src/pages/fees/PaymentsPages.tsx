import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { feeApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useConfig } from '../../context/ConfigContext';
import { DataTable } from '../../components/DataTable';
import { FilterBar } from '../../components/forms';
import { BrandMark } from '../../components/Layout';
import { Card, Loadable, PageHeader, Pagination } from '../../components/ui';
import { formatDate, formatDateTime, formatMoney, isoDaysFromToday, titleCase, todayIso } from '../../utils/format';

export function PaymentsPage() {
  const [from, setFrom] = useState(isoDaysFromToday(-30));
  const [to, setTo] = useState(todayIso());
  const [page, setPage] = useState(0);
  const query = useQuery(() => feeApi.payments({ from, to, page, size: 25 }), [from, to, page]);
  const total = (query.data?.content ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Every payment has a receipt number" />
      <Card>
        <FilterBar>
          <input type="date" className="input" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPage(0); }} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPage(0); }} aria-label="To" />
          <div className="flex items-center text-sm text-slate-600">This page: <span className="ml-1 font-semibold text-slate-800">{formatMoney(total)}</span></div>
        </FilterBar>
        <DataTable rows={query.data?.content} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No payments in this period"
          columns={[
            { header: 'Receipt', render: (row) => <Link to={`/payments/${row.id}/receipt`} className="font-mono text-xs font-semibold text-brand-700">{row.receiptNumber}</Link> },
            { header: 'Date', render: (row) => formatDate(row.paymentDate) },
            { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
            { header: 'For', render: (row) => `${row.planTitle} - ${row.installmentLabel}` },
            { header: 'Method', render: (row) => titleCase(row.paymentMethod) },
            { header: 'Reference', render: (row) => row.referenceNumber ?? '-' },
            { header: 'Amount', render: (row) => <span className="font-medium">{formatMoney(row.amount)}</span> },
            { header: 'Recorded', render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
          ]} />
        {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} totalElements={query.data.totalElements} onChange={setPage} />}
      </Card>
    </div>
  );
}

/** Printable receipt with the client's name and logo from configuration. */
export function ReceiptPage() {
  const id = Number(useParams().id);
  const { config } = useConfig();
  const query = useQuery(() => feeApi.receipt(id), [id]);

  return (
    <Loadable query={query}>
      {(receipt) => (
        <div className="mx-auto max-w-2xl">
          <div className="no-print mb-4 flex items-center justify-between">
            <Link to="/payments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Payments</Link>
            <button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print</button>
          </div>
          <Card className="p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <BrandMark size={48} />
                <div>
                  <p className="text-lg font-semibold text-slate-900">{receipt.centreName}</p>
                  {config.client.tagline && <p className="text-sm text-slate-500">{config.client.tagline}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Receipt</p>
                <p className="font-mono text-sm font-semibold text-slate-800">{receipt.receiptNumber}</p>
                <p className="text-sm text-slate-500">{formatDate(receipt.paymentDate)}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 py-5 text-sm">
              <dt className="text-slate-500">Student</dt><dd className="font-medium text-slate-800">{receipt.studentName} ({receipt.admissionNumber})</dd>
              <dt className="text-slate-500">Towards</dt><dd className="text-slate-800">{receipt.planTitle} - {receipt.installmentLabel}</dd>
              <dt className="text-slate-500">Payment method</dt><dd className="text-slate-800">{titleCase(receipt.paymentMethod)}{receipt.referenceNumber ? ` (${receipt.referenceNumber})` : ''}</dd>
              <dt className="text-slate-500">Balance on this installment</dt><dd className="text-slate-800">{formatMoney(receipt.installmentBalance)}</dd>
            </dl>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-5 py-4">
              <span className="text-sm font-medium text-slate-600">Amount received</span>
              <span className="text-2xl font-semibold text-slate-900">{formatMoney(receipt.amount)}</span>
            </div>
            <p className="mt-8 text-center text-xs text-slate-400">This is a computer-generated receipt.</p>
          </Card>
        </div>
      )}
    </Loadable>
  );
}
