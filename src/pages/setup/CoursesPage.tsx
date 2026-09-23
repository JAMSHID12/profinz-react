import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { academicApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { enumOptions, Field, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, CardHeader, Modal, PageHeader } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { Course, Subject } from '../../types';

const STATUS = ['ACTIVE', 'INACTIVE'] as const;

/** Courses and their subjects are client master data - nothing here is hard-coded. */
export default function CoursesPage() {
  const { can } = useAuth();
  const courses = useQuery(() => academicApi.courses(), []);
  const [selected, setSelected] = useState<Course | null>(null);
  const subjects = useQuery(() => academicApi.subjects(selected?.id), [selected?.id], Boolean(selected));
  const [editCourse, setEditCourse] = useState<Course | 'new' | null>(null);
  const [editSubject, setEditSubject] = useState<Subject | 'new' | null>(null);

  useEffect(() => {
    if (!selected && courses.data && courses.data.length > 0) setSelected(courses.data[0]);
  }, [courses.data, selected]);

  return (
    <div>
      <PageHeader
        title="Courses and subjects"
        subtitle="The programmes this centre offers"
        actions={can('COURSE_CREATE') && (
          <button type="button" className="btn-primary" onClick={() => setEditCourse('new')}><Plus size={16} /> Add course</button>
        )}
      />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Courses" />
          <DataTable
            rows={courses.data}
            loading={courses.loading}
            error={courses.error}
            onRetry={courses.reload}
            rowKey={(row) => row.id}
            onRowClick={setSelected}
            empty="No courses yet"
            columns={[
              { header: 'Code', render: (row) => <span className={`font-mono text-xs ${row.id === selected?.id ? 'font-bold text-brand-700' : ''}`}>{row.code}</span> },
              { header: 'Name', render: (row) => <span className={row.id === selected?.id ? 'font-semibold text-brand-700' : ''}>{row.name}</span> },
              { header: 'Course fee', render: (row) => (
                row.feeAmount !== undefined && row.feeAmount !== null ? (
                  <span className="whitespace-nowrap">
                    {formatMoney(row.feeAmount)}
                    {row.defaultInstallments ? <span className="text-xs text-slate-400"> / {row.defaultInstallments}</span> : null}
                  </span>
                ) : <span className="text-xs text-amber-600">Not set</span>
              ) },
              { header: 'Subjects', render: (row) => row.subjectCount },
              { header: 'Status', render: (row) => <Badge value={row.status} /> },
              { header: '', render: (row) => can('COURSE_UPDATE') && (
                <button type="button" className="btn-ghost" onClick={(event) => { event.stopPropagation(); setEditCourse(row); }} aria-label="Edit course"><Pencil size={14} /></button>
              ) },
            ]}
          />
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader
            title={selected ? `Subjects of ${selected.name}` : 'Subjects'}
            actions={selected && can('SUBJECT_CREATE') && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditSubject('new')}><Plus size={14} /> Add subject</button>
            )}
          />
          <DataTable
            rows={selected ? subjects.data : []}
            loading={subjects.loading}
            error={subjects.error}
            rowKey={(row) => row.id}
            empty={selected ? 'No subjects yet' : 'Select a course'}
            columns={[
              { header: 'Order', render: (row) => row.displayOrder, className: 'w-16' },
              { header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
              { header: 'Name', render: (row) => row.name },
              { header: 'Status', render: (row) => <Badge value={row.status} /> },
              { header: '', render: (row) => can('SUBJECT_UPDATE') && (
                <button type="button" className="btn-ghost" onClick={() => setEditSubject(row)} aria-label="Edit subject"><Pencil size={14} /></button>
              ) },
            ]}
          />
        </Card>
      </div>
      <CourseDialog course={editCourse} onClose={() => setEditCourse(null)} onSaved={() => { setEditCourse(null); courses.reload(); }} />
      <SubjectDialog subject={editSubject} courses={courses.data ?? []} defaultCourse={selected}
        onClose={() => setEditSubject(null)} onSaved={() => { setEditSubject(null); subjects.reload(); courses.reload(); }} />
    </div>
  );
}

function CourseDialog({ course, onClose, onSaved }: { course: Course | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = course && course !== 'new' ? course : null;
  const { values, set, setValues } = useForm({
    code: '', name: '', description: '', status: 'ACTIVE', displayOrder: '', feeAmount: '', defaultInstallments: '',
  });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      code: existing?.code ?? '',
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      status: existing?.status ?? 'ACTIVE',
      displayOrder: existing ? String(existing.displayOrder) : '',
      feeAmount: existing?.feeAmount !== undefined && existing?.feeAmount !== null ? String(existing.feeAmount) : '',
      defaultInstallments: existing?.defaultInstallments ? String(existing.defaultInstallments) : '',
    });
  }, [course]);

  const save = async () => {
    const saved = await run(
      () => academicApi.saveCourse(existing?.id, {
        ...values,
        displayOrder: numberOrUndefined(values.displayOrder),
        feeAmount: numberOrUndefined(values.feeAmount),
        defaultInstallments: numberOrUndefined(values.defaultInstallments),
      }),
      existing ? 'Course updated' : 'Course created',
    );
    if (saved) onSaved();
  };

  return (
    <Modal open={course !== null} title={existing ? 'Edit course' : 'Add course'} onClose={onClose}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Code" error={errors.code}><TextInput value={values.code} onChange={(v) => set('code', v)} placeholder="CA_INTER" /></Field>
        <Field label="Display order" error={errors.displayOrder}><TextInput value={values.displayOrder} onChange={(v) => set('displayOrder', v)} inputMode="numeric" /></Field>
      </div>
      <Field label="Name" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} /></Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Course fee" hint="Billed to every student of this course" error={errors.feeAmount}>
          <TextInput value={values.feeAmount} onChange={(v) => set('feeAmount', v)} inputMode="decimal" placeholder="20000" />
        </Field>
        <Field label="Default installments" error={errors.defaultInstallments}>
          <TextInput value={values.defaultInstallments} onChange={(v) => set('defaultInstallments', v)} inputMode="numeric" placeholder="1" />
        </Field>
      </div>
      {existing?.feeAmount !== undefined && existing?.feeAmount !== null && (
        <p className="-mt-2 mb-4 text-xs text-slate-500">
          A new fee applies to fee plans created from now on. Existing students keep the fee they were billed; give
          individual students a discount on the Fees screen.
        </p>
      )}
      <Field label="Description"><TextArea value={values.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(STATUS)} /></Field>
    </Modal>
  );
}

function SubjectDialog({ subject, courses, defaultCourse, onClose, onSaved }: {
  subject: Subject | 'new' | null; courses: Course[]; defaultCourse: Course | null; onClose: () => void; onSaved: () => void;
}) {
  const existing = subject && subject !== 'new' ? subject : null;
  const { values, set, setValues } = useForm({ courseId: '', code: '', name: '', description: '', status: 'ACTIVE', displayOrder: '' });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      courseId: String(existing?.course.id ?? defaultCourse?.id ?? ''),
      code: existing?.code ?? '',
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      status: existing?.status ?? 'ACTIVE',
      displayOrder: existing ? String(existing.displayOrder) : '',
    });
  }, [subject]);

  const save = async () => {
    const saved = await run(
      () => academicApi.saveSubject(existing?.id, {
        ...values,
        courseId: numberOrUndefined(values.courseId),
        displayOrder: numberOrUndefined(values.displayOrder),
      }),
      existing ? 'Subject updated' : 'Subject created',
    );
    if (saved) onSaved();
  };

  return (
    <Modal open={subject !== null} title={existing ? 'Edit subject' : 'Add subject'} onClose={onClose}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <Field label="Course" error={errors.courseId}>
        <SelectInput value={values.courseId} onChange={(v) => set('courseId', v)} options={refOptions(courses)} placeholder="Select" />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Code" error={errors.code}><TextInput value={values.code} onChange={(v) => set('code', v)} /></Field>
        <Field label="Display order"><TextInput value={values.displayOrder} onChange={(v) => set('displayOrder', v)} inputMode="numeric" /></Field>
      </div>
      <Field label="Name" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} /></Field>
      <Field label="Description"><TextArea value={values.description} onChange={(v) => set('description', v)} rows={2} /></Field>
      <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(STATUS)} /></Field>
    </Modal>
  );
}
