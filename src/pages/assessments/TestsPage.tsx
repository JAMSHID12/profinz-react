import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { assessmentApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader, Tabs } from '../../components/ui';
import { formatDate, isoDaysFromToday, todayIso } from '../../utils/format';
import type { AcademicTest, PublicationStatus, TestType } from '../../types';
import { PublicationActions } from './Publication';

const STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED'] as const;

export default function TestsPage() {
  const { can } = useAuth();
  const batches = useBatches();
  const [type, setType] = useState<TestType>('DAILY');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-60));
  const query = useQuery(() => assessmentApi.tests({ type, batchId, status, from }), [type, batchId, status, from]);
  const [editing, setEditing] = useState<AcademicTest | 'new' | null>(null);
  const { run, busy } = useAction();

  const move = async (test: AcademicTest, next: PublicationStatus) => {
    if (await run(() => assessmentApi.testStatus(test.id, next), `Test moved to ${next.toLowerCase()}`)) query.reload();
  };

  return (
    <div>
      <PageHeader title="Tests" subtitle="Daily and weekly tests. Marks stay private until published."
        actions={can('TEST_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New test</button>} />
      <Tabs active={type} onChange={setType} tabs={[{ key: 'DAILY', label: 'Daily tests' }, { key: 'WEEKLY', label: 'Weekly tests' }]} />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
          <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
          <input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No tests found"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.testDate) },
            { header: 'Test', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
            { header: 'Batch', render: (row) => row.batch.name },
            { header: 'Subject', render: (row) => row.subject.name },
            ...(type === 'WEEKLY' ? [{ header: 'Week', render: (row: AcademicTest) => row.weekNumber ?? '-' }] : []),
            { header: 'Max', render: (row) => row.maxMarks },
            { header: 'Marks entered', render: (row) => row.resultCount },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            {
              header: '',
              render: (row) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Link to={`/tests/${row.id}/marks`} className="btn-secondary btn-sm">Marks</Link>
                  {can('TEST_CREATE') && row.status !== 'PUBLISHED' && (
                    <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
                  )}
                  {can('TEST_PUBLISH') && <PublicationActions status={row.status} busy={busy} onChange={(next) => move(row, next)} />}
                </div>
              ),
            },
          ]} />
      </Card>
      <TestDialog test={editing} defaultType={type} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
    </div>
  );
}

function TestDialog({ test, defaultType, onClose, onSaved }: {
  test: AcademicTest | 'new' | null; defaultType: TestType; onClose: () => void; onSaved: () => void;
}) {
  const existing = test && test !== 'new' ? test : null;
  const batches = useBatches();
  const { values, set, setValues } = useForm({
    testType: defaultType as string, title: '', batchId: '', subjectId: '', testDate: todayIso(), weekNumber: '', maxMarks: '25', remarks: '',
  });
  const courseId = batches.find((batch) => batch.id === Number(values.batchId))?.course.id;
  const subjects = useSubjects(courseId);
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      testType: existing?.testType ?? defaultType,
      title: existing?.title ?? '',
      batchId: existing ? String(existing.batch.id) : '',
      subjectId: existing ? String(existing.subject.id) : '',
      testDate: existing?.testDate ?? todayIso(),
      weekNumber: existing?.weekNumber ? String(existing.weekNumber) : '',
      maxMarks: existing ? String(existing.maxMarks) : defaultType === 'WEEKLY' ? '50' : '25',
      remarks: existing?.remarks ?? '',
    });
  }, [test]);

  const save = async () => {
    const body = {
      testType: values.testType,
      title: values.title,
      batchId: numberOrUndefined(values.batchId),
      subjectId: numberOrUndefined(values.subjectId),
      testDate: values.testDate,
      weekNumber: values.testType === 'WEEKLY' ? numberOrUndefined(values.weekNumber) : undefined,
      maxMarks: numberOrUndefined(values.maxMarks),
      remarks: blankToUndefined(values.remarks),
    };
    if (await run(() => assessmentApi.saveTest(existing?.id, body), existing ? 'Test updated' : 'Test created')) onSaved();
  };

  return (
    <Modal open={test !== null} title={existing ? 'Edit test' : 'New test'} onClose={onClose} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Type"><SelectInput value={values.testType} onChange={(v) => set('testType', v)} options={enumOptions(['DAILY', 'WEEKLY'])} /></Field>
        <Field label="Title" error={errors.title}><TextInput value={values.title} onChange={(v) => set('title', v)} placeholder="Accounts daily test 6" /></Field>
        <Field label="Batch" error={errors.batchId}>
          <SelectInput value={values.batchId} onChange={(v) => { set('batchId', v); set('subjectId', ''); }} options={refOptions(batches)} placeholder="Select" />
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <SelectInput value={values.subjectId} onChange={(v) => set('subjectId', v)} options={refOptions(subjects)} placeholder={courseId ? 'Select' : 'Choose a batch first'} />
        </Field>
        <Field label="Date" error={errors.testDate}><input type="date" className="input" value={values.testDate} onChange={(e) => set('testDate', e.target.value)} /></Field>
        <Field label="Maximum marks" error={errors.maxMarks}><TextInput value={values.maxMarks} onChange={(v) => set('maxMarks', v)} inputMode="decimal" /></Field>
        {values.testType === 'WEEKLY' && (
          <Field label="Week number" error={errors.weekNumber}><TextInput value={values.weekNumber} onChange={(v) => set('weekNumber', v)} inputMode="numeric" /></Field>
        )}
      </div>
      <Field label="Remarks"><TextArea value={values.remarks} onChange={(v) => set('remarks', v)} rows={2} /></Field>
    </Modal>
  );
}
