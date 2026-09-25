import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud, CheckCircle2 } from 'lucide-react';
import { http, errorMessage } from '../../api/client';
import { academicApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/ui';
import type { ApiResponse } from '../../types';

type Kind = 'students' | 'faculty' | 'mentors' | 'fees';
interface Result {
  digest: string; total: number; valid: number; invalid: number; saved: number;
  rows: { row: number; values: Record<string, string>; errors: string[] }[];
}
const labels: Record<Kind, string> = { students: 'Students', faculty: 'Faculty', mentors: 'Mentors', fees: 'Fee structure' };
export default function ExcelImportPage({ kind }: { kind: Kind }) {
  const batches = useQuery(() => academicApi.batches({ status: 'ACTIVE' }), [], kind === 'students');
  const [batchId, setBatchId] = useState('');
  const selectedBatch = batches.data?.find(batch => String(batch.id) === batchId);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  function select(files: FileList | null) {
    if (busy) return;
    setResult(null); setError(''); setFile(null);
    if (!files?.length) return;
    if (files.length !== 1 || !files[0].name.toLowerCase().endsWith('.xlsx') || files[0].size > 2 * 1024 * 1024) {
      setError('Choose one .xlsx workbook, up to 2 MB.'); return;
    }
    setFile(files[0]);
  }
  async function download() {
    setBusy('download'); setError('');
    try {
      const response = await http.get(`/imports/${kind}/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = `profinz-${kind}-template.xlsx`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function submit(save: boolean) {
    if (!file || (save && !result) || (kind === 'students' && !batchId)) return;
    setBusy(save ? 'save' : 'preview'); setError('');
    const body = new FormData(); body.append('file', file);
    if (kind === 'students') body.append('batchId', batchId);
    if (save && result) body.append('digest', result.digest);
    try {
      const response = await http.post<ApiResponse<Result>>(`/imports/${kind}/${save ? 'save' : 'preview'}`, body,
        { headers: { 'Content-Type': undefined } });
      setResult(response.data.data);
    } catch (e) { setError(errorMessage(e)); if (save) setResult(null); } finally { setBusy(''); }
  }
  const columns = result?.rows[0] ? Object.keys(result.rows[0].values) : [];
  return <div className="space-y-6">
    <PageHeader title={`Upload ${labels[kind].toLowerCase()}`} subtitle="Bulk upload · Add multiple records in three simple steps" />
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <ol aria-label="Upload steps" className="flex flex-wrap gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm">
        {['Prepare your file', 'Upload and check', 'Review and save'].map((step, i) => <li key={step} className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800">{i + 1}</span><span className="font-medium text-slate-700">{step}</span></li>)}
      </ol>
      <section className="space-y-5 border-b border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><FileSpreadsheet className="text-blue-700" /><div><h2 className="text-lg font-semibold">1. Prepare your file</h2><p className="text-sm text-slate-500">Start with our ready-to-fill Excel template.</p></div></div>
          <button className="btn-primary" onClick={download} disabled={!!busy}><Download size={17} />{busy === 'download' ? 'Preparing…' : 'Download template'}</button>
        </div>
        {kind === 'students' && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <label htmlFor="import-batch" className="mb-2 block font-medium text-slate-900">Which batch are these students joining?</label>
          <select id="import-batch" value={batchId} disabled={!!busy || batches.loading || !!result?.saved}
            onChange={e => { setBatchId(e.target.value); setResult(null); setError(''); }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 sm:max-w-xl">
            <option value="">{batches.loading ? 'Loading batches…' : 'Choose a batch'}</option>
            {batches.data?.filter(batch => batch.status === 'ACTIVE').map(batch => <option key={batch.id} value={batch.id}>{batch.name} · {batch.course.name} · {batch.academicYear.name}</option>)}
          </select>
          <p className="mt-2 text-sm text-slate-600">Every student in this file will join the selected batch. Upload a separate file for each batch. No batch codes or IDs to type.</p>
          {batches.error && <div role="alert" className="mt-2 text-sm text-red-700">{batches.error} <button type="button" className="underline" onClick={batches.reload}>Retry</button></div>}
          {!batches.loading && !batches.error && batches.data?.length === 0 && <p className="mt-2 text-sm text-amber-800">Create an active batch in Setup before uploading students.</p>}
        </div>}
        <p className="text-sm text-slate-600">Fill the <strong>Data</strong> sheet using the sample on the <strong>Example</strong> sheet. Keep the column headings and their order unchanged. Only this template structure is accepted.</p>
        <details className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-slate-800">Format tips and what happens after saving</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5"><li>Use YYYY-MM-DD dates. Enter phone numbers as text with country codes.</li><li>Up to 200 rows per file, 2 MB maximum. Values only, no formulas.</li>
            <li>{kind === 'students' ? 'Admission numbers and student IDs are generated automatically. Parent messaging consent and student logins can be managed later in the student profile.' : kind === 'fees' ? 'Use the course IDs in Reference IDs. Only course defaults change; existing student fee plans stay as they are.' : 'Use private initial passwords. Staff must change them at first sign-in, and passwords are hidden in the preview.'}</li></ul>
        </details>
      </section>
      <section className="space-y-4 p-6">
        <div><h2 className="text-lg font-semibold">2. Upload and check</h2><p className="text-sm text-slate-500">We’ll check your file before saving any records.</p></div>
        <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Choose Excel workbook" disabled={!!busy}
          onChange={e => select(e.target.files)} onClick={e => { e.currentTarget.value = ''; }} />
        <button type="button" disabled={!!busy} onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files); }}
          className={`flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-500'}`}>
          <UploadCloud className="text-blue-700" size={32} /><span className="break-all font-medium">{file ? file.name : 'Drop your completed Excel file here'}</span>
          <span className="text-sm text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB · Click to replace` : 'or click to choose a file · .xlsx only'}</span>
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{kind === 'students' && !batchId ? 'Choose a batch above to continue.' : 'Nothing is saved until you review and confirm below.'}</p>
          <button className="btn-primary" disabled={!file || !!busy || !!result?.saved || (kind === 'students' && !batchId)} onClick={() => submit(false)}>{busy === 'preview' ? 'Checking file…' : 'Check file and preview'}</button>
        </div>
      </section>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {result && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
        <div><h2 className="text-lg font-semibold">3. Review and save</h2><p className="text-sm text-slate-600">{selectedBatch && <span className="font-medium">Batch: {selectedBatch.name} · </span>}{result.total} rows · {result.valid} valid · {result.invalid} need correction</p></div>
        {!result.saved && <button className="btn-primary" disabled={!!busy || result.invalid > 0} onClick={() => submit(true)}>{busy === 'save' ? 'Saving…' : `Save ${result.valid} records`}</button>}
      </div>
      {result.saved > 0 && <div role="status" className="flex items-center gap-2 bg-green-50 p-4 text-green-800"><CheckCircle2 size={20} />{result.saved} records saved successfully.<button className="ml-auto underline" onClick={() => { setResult(null); setFile(null); setBatchId(''); }}>Upload another file</button></div>}
      {result.invalid > 0 && <p role="alert" className="bg-amber-50 p-4 text-sm text-amber-900">Nothing has been saved. Correct the rows listed below, upload the updated workbook, and validate again.</p>}
      <div className="max-h-[32rem] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Excel row</th><th className="p-3">Validation</th>{columns.map(c => <th key={c} className="whitespace-nowrap p-3">{c.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>{result.rows.map(row => <tr key={row.row} className="border-t border-slate-100"><td className="p-3">{row.row}</td><td className={`min-w-64 p-3 ${row.errors.length ? 'text-red-700' : 'text-green-700'}`}>{row.errors.length ? row.errors.join('; ') : 'Valid'}</td>{columns.map(c => <td key={c} className="whitespace-nowrap p-3">{row.values[c] || '—'}</td>)}</tr>)}</tbody>
      </table></div>
    </section>}
  </div>;
}

