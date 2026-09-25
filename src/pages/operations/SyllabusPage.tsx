import { useEffect, useState } from 'react';
import { eligibilityLabel } from '../../utils/eligibility';
import { Pencil, Plus } from 'lucide-react';
import { syllabusApi, educationCategoryApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useCourses, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { SyllabusView } from '../../components/academic';
import { blankToUndefined, Checkbox, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, EmptyState, Loadable, Modal, PageHeader, Tabs } from '../../components/ui';
import type { SyllabusProgressRow, SyllabusTopic } from '../../types';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED'] as const;

export default function SyllabusPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'progress' | 'topics'>('progress');
  return (
    <div>
      <PageHeader title="Syllabus" subtitle="Topics per subject and how far each batch has progressed" />
      <Tabs active={tab} onChange={setTab}
        tabs={[{ key: 'progress', label: 'Batch progress' }, { key: 'topics', label: 'Topics', hidden: !can('SYLLABUS_MANAGE') }]} />
      {tab === 'progress' ? <ProgressTab /> : <TopicsTab />}
    </div>
  );
}

function ProgressTab() {
  const { can } = useAuth();
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const query = useQuery(() => syllabusApi.progress(Number(batchId)), [batchId], Boolean(batchId));
  const [editing, setEditing] = useState<SyllabusProgressRow | null>(null);
  const { values, set, setValues } = useForm({ status: 'NOT_STARTED', plannedDate: '', completedDate: '', remarks: '' });
  const { run, busy, errors } = useAction();

  useEffect(() => {
    if (!batchId && batches.length > 0) setBatchId(String(batches[0].id));
  }, [batches, batchId]);

  useEffect(() => {
    if (editing) {
      setValues({
        status: editing.status === 'DELAYED' ? 'IN_PROGRESS' : editing.status,
        plannedDate: editing.plannedDate ?? '',
        completedDate: editing.completedDate ?? '',
        remarks: editing.remarks ?? '',
      });
    }
  }, [editing]);

  const save = async () => {
    if (!editing) return;
    const saved = await run(() => syllabusApi.updateProgress(Number(batchId), editing.topicId, {
      status: values.status,
      plannedDate: blankToUndefined(values.plannedDate),
      completedDate: blankToUndefined(values.completedDate),
      remarks: blankToUndefined(values.remarks),
    }), 'Syllabus progress updated');
    if (saved) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="sm:max-w-xs">
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="Select a batch" />
        </div>
      </Card>
      {!batchId ? <Card><EmptyState title="Choose a batch" /></Card> : (
        <Loadable query={query}>
          {(syllabus) => <SyllabusView syllabus={syllabus} onEdit={can('SYLLABUS_UPDATE') ? setEditing : undefined} />}
        </Loadable>
      )}
      <Modal open={editing !== null} title={editing?.title ?? ''} onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        <p className="mb-3 text-xs text-slate-500">Topics past their planned date and not completed show as delayed automatically.</p>
        <Field label="Status" error={errors.status}>
          <SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(STATUSES.filter((s) => s !== 'DELAYED'))} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Planned date"><input type="date" className="input" value={values.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} /></Field>
          <Field label="Completed on" error={errors.completedDate}><input type="date" className="input" value={values.completedDate} onChange={(e) => set('completedDate', e.target.value)} /></Field>
        </div>
        <Field label="Remarks"><TextInput value={values.remarks} onChange={(v) => set('remarks', v)} /></Field>
      </Modal>
    </div>
  );
}

function TopicsTab() {
  const categories = useQuery(() => educationCategoryApi.list(), []);
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const subjects = useSubjects(courseId ? Number(courseId) : undefined);
  const [subjectId, setSubjectId] = useState('');
  const query = useQuery(() => syllabusApi.topics({ courseId, subjectId }), [courseId, subjectId]);
  const [editing, setEditing] = useState<SyllabusTopic | 'new' | null>(null);
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({ subjectId: '', title: '', description: '', sequenceNo: '', plannedHours: '', active: true, eligibility: 'BOTH' });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      subjectId: existing ? String(existing.subject.id) : subjectId,
      title: existing?.title ?? '',
      description: existing?.description ?? '',
      sequenceNo: existing ? String(existing.sequenceNo) : '',
      plannedHours: existing?.plannedHours ? String(existing.plannedHours) : '',
      active: existing?.active ?? true,
      eligibility: existing?.educationCategory ? String(existing.educationCategory.id) : 'BOTH',
    });
  }, [editing]);

  const save = async () => {
    const saved = await run(() => syllabusApi.saveTopic(existing?.id, {
      subjectId: numberOrUndefined(values.subjectId),
      title: values.title,
      description: blankToUndefined(values.description),
      sequenceNo: numberOrUndefined(values.sequenceNo),
      plannedHours: numberOrUndefined(values.plannedHours),
      active: values.active,
      eligibility: values.eligibility === 'BOTH' ? 'BOTH' : 'CATEGORY_ONLY',
      educationCategoryId: values.eligibility === 'BOTH' ? null : Number(values.eligibility),
    }), existing ? 'Topic updated' : 'Topic added');
    if (saved) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <Card>
      <FilterBar>
        <SelectInput value={courseId} onChange={(v) => { setCourseId(v); setSubjectId(''); }} options={refOptions(courses)} placeholder="All courses" />
        <SelectInput value={subjectId} onChange={setSubjectId} options={refOptions(subjects)} placeholder="All subjects" />
        <div />
        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add topic</button></div>
      </FilterBar>
      <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No topics yet"
        columns={[
          { header: '#', render: (row) => row.sequenceNo, className: 'w-12' },
          { header: 'Topic', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
          { header: 'Subject', render: (row) => row.subject.name },
          { header: 'Course', render: (row) => row.course.name },
          { header: 'Attendance eligibility', render: (row) => eligibilityLabel(row.eligibility, row.educationCategory) },
          { header: 'Hours', render: (row) => row.plannedHours ?? '-' },
          { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
          { header: '', render: (row) => <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button> },
        ]} />
      <Modal open={editing !== null} title={existing ? 'Edit topic' : 'Add topic'} onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        <Field label="Subject" error={errors.subjectId}>
          <SelectInput value={values.subjectId} onChange={(v) => set('subjectId', v)} placeholder="Select"
            options={subjects.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.course.name})` }))} />
        </Field>
        <Field label="Title" error={errors.title}><TextInput value={values.title} onChange={(v) => set('title', v)} /></Field>
        <Field label="Attendance eligibility" hint="Configure categories in Setup → Master data. Students outside the selected category receive Holiday." error={categories.error ?? errors.educationCategoryId ?? undefined}>
          <SelectInput value={values.eligibility} onChange={v => set('eligibility', v)} disabled={categories.loading || Boolean(categories.error)} options={[{ value: 'BOTH', label: 'All Categories (Both)' }, ...(categories.data ?? []).filter(c => c.active || c.id === existing?.educationCategory?.id).map(c => ({ value: String(c.id), label: c.name + ' Only' + (c.active ? '' : ' (inactive)') }))]} />
        </Field>
        <Field label="Description"><TextArea value={values.description} onChange={(v) => set('description', v)} rows={2} /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Sequence" error={errors.sequenceNo}><TextInput value={values.sequenceNo} onChange={(v) => set('sequenceNo', v)} inputMode="numeric" /></Field>
          <Field label="Planned hours" error={errors.plannedHours}><TextInput value={values.plannedHours} onChange={(v) => set('plannedHours', v)} inputMode="decimal" /></Field>
        </div>
        <Checkbox checked={values.active} onChange={(v) => set('active', v)} label="Active" />
      </Modal>
    </Card>
  );
}
