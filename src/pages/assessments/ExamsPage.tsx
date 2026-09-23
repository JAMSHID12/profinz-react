import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { assessmentApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useExamTypes, useFacultyList, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader } from '../../components/ui';
import { formatDate, isoDaysFromToday, todayIso } from '../../utils/format';
import type { Exam, PublicationStatus } from '../../types';
import { PublicationActions } from './Publication';

const STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED'] as const;

export default function ExamsPage() {
  const { can } = useAuth();
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-90));
  const query = useQuery(() => assessmentApi.exams({ batchId, status, from }), [batchId, status, from]);
  const [editing, setEditing] = useState<Exam | 'new' | null>(null);
  const { run, busy } = useAction();

  const move = async (exam: Exam, next: PublicationStatus) => {
    if (await run(() => assessmentApi.examStatus(exam.id, next), `Exam moved to ${next.toLowerCase()}`)) query.reload();
  };

  return (
    <div>
      <PageHeader title="Exams" subtitle="Scheduled exams, marks and published results"
        actions={can('EXAM_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New exam</button>} />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
          <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
          <input type="date" className="input" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No exams found"
          columns={[
            { header: 'Date', render: (row) => `${formatDate(row.examDate)}${row.startTime ? ` ${row.startTime}` : ''}` },
            { header: 'Exam', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
            { header: 'Type', render: (row) => row.examType.name },
            { header: 'Batch', render: (row) => row.batch.name },
            { header: 'Subject', render: (row) => row.subject.name },
            { header: 'Max / pass', render: (row) => `${row.maxMarks} / ${row.passingMarks}` },
            { header: 'Marks entered', render: (row) => row.resultCount },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            {
              header: '',
              render: (row) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Link to={`/exams/${row.id}/marks`} className="btn-secondary btn-sm">Marks</Link>
                  {can('EXAM_CREATE') && row.status !== 'PUBLISHED' && (
                    <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
                  )}
                  {can('EXAM_PUBLISH') && <PublicationActions status={row.status} busy={busy} onChange={(next) => move(row, next)} />}
                </div>
              ),
            },
          ]} />
      </Card>
      <ExamDialog exam={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
    </div>
  );
}

function ExamDialog({ exam, onClose, onSaved }: { exam: Exam | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = exam && exam !== 'new' ? exam : null;
  const batches = useBatches();
  const examTypes = useExamTypes().filter((type) => type.active);
  const faculty = useFacultyList();
  const { values, set, setValues } = useForm({
    name: '', examTypeId: '', batchId: '', subjectId: '', examDate: todayIso(), startTime: '', endTime: '', maxMarks: '100', passingMarks: '40', facultyId: '', remarks: '',
  });
  const courseId = batches.find((batch) => batch.id === Number(values.batchId))?.course.id;
  const subjects = useSubjects(courseId);
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      name: existing?.name ?? '',
      examTypeId: existing ? String(existing.examType.id) : '',
      batchId: existing ? String(existing.batch.id) : '',
      subjectId: existing ? String(existing.subject.id) : '',
      examDate: existing?.examDate ?? todayIso(),
      startTime: existing?.startTime ?? '',
      endTime: existing?.endTime ?? '',
      maxMarks: existing ? String(existing.maxMarks) : '100',
      passingMarks: existing ? String(existing.passingMarks) : '40',
      facultyId: existing?.faculty ? String(existing.faculty.id) : '',
      remarks: existing?.remarks ?? '',
    });
  }, [exam]);

  const save = async () => {
    const body = {
      name: values.name,
      examTypeId: numberOrUndefined(values.examTypeId),
      batchId: numberOrUndefined(values.batchId),
      subjectId: numberOrUndefined(values.subjectId),
      examDate: values.examDate,
      startTime: blankToUndefined(values.startTime),
      endTime: blankToUndefined(values.endTime),
      maxMarks: numberOrUndefined(values.maxMarks),
      passingMarks: numberOrUndefined(values.passingMarks),
      facultyId: numberOrUndefined(values.facultyId),
      remarks: blankToUndefined(values.remarks),
    };
    if (await run(() => assessmentApi.saveExam(existing?.id, body), existing ? 'Exam updated' : 'Exam created')) onSaved();
  };

  return (
    <Modal open={exam !== null} title={existing ? 'Edit exam' : 'New exam'} onClose={onClose} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Exam name" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} /></Field>
        <Field label="Exam type" error={errors.examTypeId}><SelectInput value={values.examTypeId} onChange={(v) => set('examTypeId', v)} options={refOptions(examTypes)} placeholder="Select" /></Field>
        <Field label="Batch" error={errors.batchId}>
          <SelectInput value={values.batchId} onChange={(v) => { set('batchId', v); set('subjectId', ''); }} options={refOptions(batches)} placeholder="Select" />
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <SelectInput value={values.subjectId} onChange={(v) => set('subjectId', v)} options={refOptions(subjects)} placeholder={courseId ? 'Select' : 'Choose a batch first'} />
        </Field>
        <Field label="Date" error={errors.examDate}><input type="date" className="input" value={values.examDate} onChange={(e) => set('examDate', e.target.value)} /></Field>
        <Field label="Invigilator / faculty"><SelectInput value={values.facultyId} onChange={(v) => set('facultyId', v)} options={refOptions(faculty)} placeholder="None" /></Field>
        <Field label="Start" error={errors.startTime}><input type="time" className="input" value={values.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="End" error={errors.endTime}><input type="time" className="input" value={values.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
        <Field label="Maximum marks" error={errors.maxMarks}><TextInput value={values.maxMarks} onChange={(v) => set('maxMarks', v)} inputMode="decimal" /></Field>
        <Field label="Passing marks" error={errors.passingMarks}><TextInput value={values.passingMarks} onChange={(v) => set('passingMarks', v)} inputMode="decimal" /></Field>
      </div>
      <Field label="Remarks"><TextArea value={values.remarks} onChange={(v) => set('remarks', v)} rows={2} /></Field>
    </Modal>
  );
}
