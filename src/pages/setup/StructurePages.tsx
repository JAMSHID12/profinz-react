import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { academicApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useCourses, useMentors, useYears } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader } from '../../components/ui';
import { formatDate } from '../../utils/format';
import type { AcademicYear, Batch } from '../../types';

const YEAR_STATUS = ['PLANNED', 'ACTIVE', 'CLOSED'] as const;
const BATCH_STATUS = ['ACTIVE', 'COMPLETED', 'INACTIVE'] as const;

export function AcademicYearsPage() {
  const { can } = useAuth();
  const query = useQuery(() => academicApi.years(), []);
  const [editing, setEditing] = useState<AcademicYear | 'new' | null>(null);
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({ name: '', startDate: '', endDate: '', current: false, status: 'PLANNED' });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      name: existing?.name ?? '',
      startDate: existing?.startDate ?? '',
      endDate: existing?.endDate ?? '',
      current: existing?.current ?? false,
      status: existing?.status ?? 'PLANNED',
    });
  }, [editing]);

  const save = async () => {
    const saved = await run(() => academicApi.saveYear(existing?.id, values), existing ? 'Academic year updated' : 'Academic year created');
    if (saved) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Academic years" subtitle="The current year is used by default for new batches and fee plans"
        actions={can('ACADEMIC_YEAR_MANAGE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add year</button>} />
      <Card>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
          empty="No academic years yet"
          columns={[
            { header: 'Year', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
            { header: 'Starts', render: (row) => formatDate(row.startDate) },
            { header: 'Ends', render: (row) => formatDate(row.endDate) },
            { header: 'Current', render: (row) => (row.current ? <Badge value="ACTIVE" label="Current" /> : '') },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: '', render: (row) => can('ACADEMIC_YEAR_MANAGE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>
      <Modal open={editing !== null} title={existing ? 'Edit academic year' : 'Add academic year'} onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        <Field label="Name" hint="Format 2026-2027" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Start date" error={errors.startDate}><input type="date" className="input" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="End date" error={errors.endDate}><input type="date" className="input" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        </div>
        <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(YEAR_STATUS)} /></Field>
        <Checkbox checked={values.current} onChange={(v) => set('current', v)} label="This is the current academic year" />
      </Modal>
    </div>
  );
}

export function BatchesPage() {
  const { can } = useAuth();
  const courses = useCourses();
  const years = useYears();
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const query = useQuery(() => academicApi.batches({ courseId, status }), [courseId, status]);
  const [editing, setEditing] = useState<Batch | 'new' | null>(null);

  return (
    <div>
      <PageHeader title="Batches" subtitle={can('BATCH_VIEW') ? 'Groups of students by course and year' : 'Your batches'}
        actions={can('BATCH_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add batch</button>} />
      <Card>
        <FilterBar>
          <SelectInput value={courseId} onChange={setCourseId} options={refOptions(courses)} placeholder="All courses" />
          <SelectInput value={status} onChange={setStatus} options={enumOptions(BATCH_STATUS)} placeholder="Any status" />
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
          empty="No batches found"
          columns={[
            { header: 'Batch', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
            { header: 'Course', render: (row) => row.course.name },
            { header: 'Year', render: (row) => row.academicYear.name },
            { header: 'Mentor', render: (row) => row.mentor?.name ?? <span className="text-slate-400">Unassigned</span> },
            { header: 'Students', render: (row) => `${row.studentCount}${row.capacity ? ` / ${row.capacity}` : ''}` },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: '', render: (row) => can('BATCH_UPDATE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>
      <BatchDialog batch={editing} courses={courses} years={years} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); query.reload(); }} />
    </div>
  );
}

function BatchDialog({ batch, courses, years, onClose, onSaved }: {
  batch: Batch | 'new' | null;
  courses: { id: number; name: string }[];
  years: AcademicYear[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const mentors = useMentors();
  const existing = batch && batch !== 'new' ? batch : null;
  const { values, set, setValues } = useForm({
    name: '', courseId: '', academicYearId: '', mentorId: '', startDate: '', endDate: '', capacity: '', status: 'ACTIVE', description: '',
  });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    const currentYear = years.find((year) => year.current);
    setValues({
      name: existing?.name ?? '',
      courseId: existing ? String(existing.course.id) : '',
      academicYearId: String(existing?.academicYear.id ?? currentYear?.id ?? ''),
      mentorId: existing?.mentor ? String(existing.mentor.id) : '',
      startDate: existing?.startDate ?? '',
      endDate: existing?.endDate ?? '',
      capacity: existing?.capacity ? String(existing.capacity) : '',
      status: existing?.status ?? 'ACTIVE',
      description: existing?.description ?? '',
    });
  }, [batch]);

  const save = async () => {
    const body = {
      name: values.name,
      courseId: numberOrUndefined(values.courseId),
      academicYearId: numberOrUndefined(values.academicYearId),
      mentorId: numberOrUndefined(values.mentorId),
      startDate: blankToUndefined(values.startDate),
      endDate: blankToUndefined(values.endDate),
      capacity: numberOrUndefined(values.capacity),
      status: values.status,
      description: blankToUndefined(values.description),
    };
    const saved = await run(() => academicApi.saveBatch(existing?.id, body), existing ? 'Batch updated' : 'Batch created');
    if (saved) onSaved();
  };

  return (
    <Modal open={batch !== null} title={existing ? `Edit ${existing.name}` : 'Add batch'} onClose={onClose} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Batch name" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} placeholder="CA Inter A" /></Field>
        <Field label="Course" error={errors.courseId}><SelectInput value={values.courseId} onChange={(v) => set('courseId', v)} options={refOptions(courses)} placeholder="Select" /></Field>
        <Field label="Academic year" error={errors.academicYearId}><SelectInput value={values.academicYearId} onChange={(v) => set('academicYearId', v)} options={refOptions(years)} placeholder="Select" /></Field>
        <Field label="Mentor"><SelectInput value={values.mentorId} onChange={(v) => set('mentorId', v)} options={refOptions(mentors)} placeholder="Unassigned" /></Field>
        <Field label="Start date" error={errors.startDate}><input type="date" className="input" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="End date" error={errors.endDate}><input type="date" className="input" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Capacity" error={errors.capacity}><TextInput value={values.capacity} onChange={(v) => set('capacity', v)} inputMode="numeric" /></Field>
        <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(BATCH_STATUS)} /></Field>
      </div>
      <Field label="Description"><TextArea value={values.description} onChange={(v) => set('description', v)} rows={2} /></Field>
    </Modal>
  );
}
