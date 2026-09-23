import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { disciplineApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useDisciplineTypes, useStudents } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader, Tabs } from '../../components/ui';
import { formatDate, formatMoney, isoDaysFromToday, todayIso } from '../../utils/format';
import type { DisciplineRecord, Fine } from '../../types';

const FINE_STATUSES = ['PENDING', 'PAID', 'WAIVED', 'CANCELLED'] as const;

export default function DisciplinePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'records' | 'fines'>(can('DISCIPLINE_VIEW') ? 'records' : 'fines');
  return (
    <div>
      <PageHeader title="Discipline and fines" subtitle="Incidents, action taken and fines - parents are informed of new fines" />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'records', label: 'Discipline records', hidden: !can('DISCIPLINE_VIEW') },
        { key: 'fines', label: 'Fines', hidden: !can('FINE_VIEW') },
      ]} />
      {tab === 'records' ? <RecordsTab /> : <FinesTab />}
    </div>
  );
}

/** Student picker narrowed by batch, shared by the discipline, fine and meeting forms. */
export function StudentPicker({ batchId, studentId, onBatch, onStudent, error }: {
  batchId: string; studentId: string; onBatch: (value: string) => void; onStudent: (value: string) => void; error?: string;
}) {
  const batches = useBatches();
  const students = useStudents(batchId ? Number(batchId) : undefined);
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      <Field label="Batch"><SelectInput value={batchId} onChange={(v) => { onBatch(v); onStudent(''); }} options={refOptions(batches)} placeholder="All batches" /></Field>
      <Field label="Student" error={error}>
        <SelectInput value={studentId} onChange={onStudent} placeholder="Select"
          options={students.map((student) => ({ value: student.id, label: `${student.fullName} (${student.admissionNumber})` }))} />
      </Field>
    </div>
  );
}

function RecordsTab() {
  const { can } = useAuth();
  const batches = useBatches();
  const types = useDisciplineTypes().filter((type) => type.active);
  const [batchId, setBatchId] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-60));
  const [to, setTo] = useState(todayIso());
  const query = useQuery(() => disciplineApi.records({ batchId, from, to }), [batchId, from, to]);
  const [editing, setEditing] = useState<DisciplineRecord | 'new' | null>(null);
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({
    batchId: '', studentId: '', disciplineTypeId: '', incidentDate: todayIso(), description: '', actionTaken: '', status: 'OPEN', fineAmount: '', fineDueDate: '',
  });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      batchId: existing?.batch ? String(existing.batch.id) : '',
      studentId: existing ? String(existing.student.id) : '',
      disciplineTypeId: existing ? String(existing.disciplineType.id) : '',
      incidentDate: existing?.incidentDate ?? todayIso(),
      description: existing?.description ?? '',
      actionTaken: existing?.actionTaken ?? '',
      status: existing?.status ?? 'OPEN',
      fineAmount: '',
      fineDueDate: '',
    });
  }, [editing]);

  const chooseType = (id: string) => {
    const type = types.find((item) => item.id === Number(id));
    setValues((current) => ({
      ...current,
      disciplineTypeId: id,
      fineAmount: !existing && type?.defaultFineAmount ? String(type.defaultFineAmount) : current.fineAmount,
    }));
  };

  const save = async () => {
    const body = {
      studentId: numberOrUndefined(values.studentId),
      disciplineTypeId: numberOrUndefined(values.disciplineTypeId),
      incidentDate: values.incidentDate,
      description: values.description,
      actionTaken: blankToUndefined(values.actionTaken),
      status: values.status,
      fineAmount: existing ? undefined : numberOrUndefined(values.fineAmount),
      fineDueDate: existing ? undefined : blankToUndefined(values.fineDueDate),
    };
    if (await run(() => disciplineApi.saveRecord(existing?.id, body), existing ? 'Record updated' : 'Discipline record saved')) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <Card>
      <FilterBar>
        <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
        <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
        <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
        <div className="flex justify-end">
          {can('DISCIPLINE_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Record incident</button>}
        </div>
      </FilterBar>
      <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No discipline records"
        columns={[
          { header: 'Date', render: (row) => formatDate(row.incidentDate) },
          { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
          { header: 'Batch', render: (row) => row.batch?.name ?? '-' },
          { header: 'Type', render: (row) => row.disciplineType.name },
          { header: 'Details', render: (row) => row.description },
          { header: 'Action', render: (row) => row.actionTaken ?? '-' },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: '', render: (row) => can('DISCIPLINE_UPDATE') && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
          ) },
        ]} />
      <Modal open={editing !== null} title={existing ? 'Edit discipline record' : 'Record an incident'} onClose={() => setEditing(null)} wide
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        {existing ? (
          <p className="mb-4 text-sm text-slate-600">{existing.student.name} ({existing.admissionNumber})</p>
        ) : (
          <StudentPicker batchId={values.batchId} studentId={values.studentId} error={errors.studentId}
            onBatch={(v) => set('batchId', v)} onStudent={(v) => set('studentId', v)} />
        )}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Type" error={errors.disciplineTypeId}><SelectInput value={values.disciplineTypeId} onChange={chooseType} options={refOptions(types)} placeholder="Select" /></Field>
          <Field label="Date" error={errors.incidentDate}><input type="date" className="input" value={values.incidentDate} max={todayIso()} onChange={(e) => set('incidentDate', e.target.value)} /></Field>
        </div>
        <Field label="What happened" error={errors.description}><TextArea value={values.description} onChange={(v) => set('description', v)} rows={2} /></Field>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Action taken"><TextInput value={values.actionTaken} onChange={(v) => set('actionTaken', v)} /></Field>
          <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(['OPEN', 'RESOLVED'])} /></Field>
          {!existing && (
            <>
              <Field label="Fine amount (optional)" hint="Creates a fine for the student" error={errors.fineAmount}>
                <TextInput value={values.fineAmount} onChange={(v) => set('fineAmount', v)} inputMode="decimal" />
              </Field>
              <Field label="Fine due date"><input type="date" className="input" value={values.fineDueDate} onChange={(e) => set('fineDueDate', e.target.value)} /></Field>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}

function FinesTab() {
  const { can } = useAuth();
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const query = useQuery(() => disciplineApi.fines({ batchId, status }), [batchId, status]);
  const [creating, setCreating] = useState(false);
  const [changing, setChanging] = useState<Fine | null>(null);
  const create = useForm({ batchId: '', studentId: '', reason: '', amount: '', fineDate: todayIso(), dueDate: '', remarks: '' });
  const change = useForm({ status: 'PAID', paidDate: todayIso(), paymentReference: '', remarks: '' });
  const { run, busy, errors } = useAction();

  const saveFine = async () => {
    const v = create.values;
    const saved = await run(() => disciplineApi.createFine({
      studentId: numberOrUndefined(v.studentId), reason: v.reason, amount: numberOrUndefined(v.amount),
      fineDate: v.fineDate, dueDate: blankToUndefined(v.dueDate), remarks: blankToUndefined(v.remarks),
    }), 'Fine created');
    if (saved) {
      setCreating(false);
      create.reset();
      query.reload();
    }
  };

  const saveStatus = async () => {
    if (!changing) return;
    const v = change.values;
    const saved = await run(() => disciplineApi.fineStatus(changing.id, {
      status: v.status, paidDate: v.status === 'PAID' ? v.paidDate : undefined,
      paymentReference: blankToUndefined(v.paymentReference), remarks: blankToUndefined(v.remarks),
    }), `Fine marked ${v.status.toLowerCase()}`);
    if (saved) {
      setChanging(null);
      query.reload();
    }
  };

  return (
    <Card>
      <FilterBar>
        <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
        <SelectInput value={status} onChange={setStatus} options={enumOptions(FINE_STATUSES)} placeholder="Any status" />
        <div />
        <div className="flex justify-end">
          {can('FINE_CREATE') && <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New fine</button>}
        </div>
      </FilterBar>
      <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No fines"
        columns={[
          { header: 'Date', render: (row) => formatDate(row.fineDate) },
          { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
          { header: 'Batch', render: (row) => row.batch?.name ?? '-' },
          { header: 'Reason', render: (row) => row.reason },
          { header: 'Amount', render: (row) => formatMoney(row.amount) },
          { header: 'Due', render: (row) => formatDate(row.dueDate) },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: '', render: (row) => can('FINE_UPDATE') && row.status === 'PENDING' && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => { change.reset(); setChanging(row); }}>Update</button>
          ) },
        ]} />
      <Modal open={creating} title="New fine" onClose={() => setCreating(false)} wide
        footer={<><button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={saveFine} disabled={busy}>Save</button></>}>
        <StudentPicker batchId={create.values.batchId} studentId={create.values.studentId} error={errors.studentId}
          onBatch={(v) => create.set('batchId', v)} onStudent={(v) => create.set('studentId', v)} />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Reason" error={errors.reason}><TextInput value={create.values.reason} onChange={(v) => create.set('reason', v)} /></Field>
          <Field label="Amount" error={errors.amount}><TextInput value={create.values.amount} onChange={(v) => create.set('amount', v)} inputMode="decimal" /></Field>
          <Field label="Fine date" error={errors.fineDate}><input type="date" className="input" value={create.values.fineDate} onChange={(e) => create.set('fineDate', e.target.value)} /></Field>
          <Field label="Due date"><input type="date" className="input" value={create.values.dueDate} onChange={(e) => create.set('dueDate', e.target.value)} /></Field>
        </div>
        <Field label="Remarks"><TextInput value={create.values.remarks} onChange={(v) => create.set('remarks', v)} /></Field>
      </Modal>
      <Modal open={changing !== null} title={`Fine: ${changing?.reason ?? ''}`} onClose={() => setChanging(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setChanging(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={saveStatus} disabled={busy}>Save</button></>}>
        <p className="mb-4 text-sm text-slate-600">{changing?.student.name} &middot; {formatMoney(changing?.amount)}</p>
        <Field label="New status"><SelectInput value={change.values.status} onChange={(v) => change.set('status', v)} options={enumOptions(['PAID', 'WAIVED', 'CANCELLED'])} /></Field>
        {change.values.status === 'PAID' && (
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Paid on" error={errors.paidDate}><input type="date" className="input" value={change.values.paidDate} onChange={(e) => change.set('paidDate', e.target.value)} /></Field>
            <Field label="Reference"><TextInput value={change.values.paymentReference} onChange={(v) => change.set('paymentReference', v)} /></Field>
          </div>
        )}
        <Field label="Remarks"><TextInput value={change.values.remarks} onChange={(v) => change.set('remarks', v)} /></Field>
      </Modal>
    </Card>
  );
}
