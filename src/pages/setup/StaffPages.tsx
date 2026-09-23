import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { staffApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, enumOptions, Field, refOptions, SelectInput, TextInput } from '../../components/forms';
import { Badge, Card, CardHeader, Modal, PageHeader } from '../../components/ui';
import { titleCase } from '../../utils/format';
import type { Faculty, Mentor } from '../../types';

const FACULTY_TYPES = ['FULL_TIME', 'GUEST', 'VISITING'] as const;

type Person = Mentor | Faculty;

/** Shared create/edit form for mentors and faculty; creating one also creates their login. */
function StaffDialog({ kind, person, onClose, onSaved }: {
  kind: 'mentor' | 'faculty'; person: Person | 'new' | null; onClose: () => void; onSaved: () => void;
}) {
  const existing = person && person !== 'new' ? person : null;
  const { values, set, setValues } = useForm({
    fullName: '', employeeCode: '', mobile: '', email: '', specialization: '', facultyType: 'FULL_TIME', active: true, username: '', password: '',
  });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      fullName: existing?.fullName ?? '',
      employeeCode: existing?.employeeCode ?? '',
      mobile: existing?.mobile ?? '',
      email: existing?.email ?? '',
      specialization: existing?.specialization ?? '',
      facultyType: (existing as Faculty | null)?.facultyType ?? 'FULL_TIME',
      active: existing?.active ?? true,
      username: '',
      password: '',
    });
  }, [person]);

  const save = async () => {
    const body = {
      fullName: values.fullName,
      employeeCode: blankToUndefined(values.employeeCode),
      mobile: blankToUndefined(values.mobile),
      email: blankToUndefined(values.email),
      specialization: blankToUndefined(values.specialization),
      facultyType: kind === 'faculty' ? values.facultyType : undefined,
      active: values.active,
      username: existing ? undefined : blankToUndefined(values.username),
      password: existing ? undefined : blankToUndefined(values.password),
    };
    const label = kind === 'mentor' ? 'Mentor' : 'Faculty member';
    const saved = await run<unknown>(
      () => (kind === 'mentor' ? staffApi.saveMentor(existing?.id, body) : staffApi.saveFaculty(existing?.id, body)),
      existing ? `${label} updated` : `${label} created with a login`,
    );
    if (saved) onSaved();
  };

  return (
    <Modal open={person !== null} title={`${existing ? 'Edit' : 'Add'} ${kind === 'mentor' ? 'mentor' : 'faculty member'}`} onClose={onClose} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName}><TextInput value={values.fullName} onChange={(v) => set('fullName', v)} /></Field>
        <Field label="Employee code" error={errors.employeeCode}><TextInput value={values.employeeCode} onChange={(v) => set('employeeCode', v)} /></Field>
        <Field label="Mobile" error={errors.mobile}><TextInput value={values.mobile} onChange={(v) => set('mobile', v)} inputMode="tel" /></Field>
        <Field label="E-mail" error={errors.email}><TextInput value={values.email} onChange={(v) => set('email', v)} type="email" /></Field>
        <Field label="Specialisation"><TextInput value={values.specialization} onChange={(v) => set('specialization', v)} /></Field>
        {kind === 'faculty' && (
          <Field label="Type"><SelectInput value={values.facultyType} onChange={(v) => set('facultyType', v)} options={enumOptions(FACULTY_TYPES)} /></Field>
        )}
        {!existing && (
          <>
            <Field label="Login username" error={errors.username}><TextInput value={values.username} onChange={(v) => set('username', v)} autoComplete="off" /></Field>
            <Field label="Temporary password" hint="Changed by the user at first sign-in" error={errors.password}>
              <input type="password" className="input" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <Checkbox checked={values.active} onChange={(v) => set('active', v)} label="Active" />
    </Modal>
  );
}

export function MentorsPage() {
  const { can } = useAuth();
  const query = useQuery(() => staffApi.mentors(), []);
  const [editing, setEditing] = useState<Mentor | 'new' | null>(null);
  return (
    <div>
      <PageHeader title="Mentors" subtitle="Mentors look after the students of their batches"
        actions={can('MENTOR_MANAGE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add mentor</button>} />
      <Card>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No mentors yet"
          columns={[
            { header: 'Name', render: (row) => <span className="font-medium text-slate-800">{row.fullName}</span> },
            { header: 'Code', render: (row) => row.employeeCode ?? '-' },
            { header: 'Contact', render: (row) => [row.mobile, row.email].filter(Boolean).join(' · ') || '-' },
            { header: 'Batches', render: (row) => row.batchCount },
            { header: 'Login', render: (row) => row.username ?? '-' },
            { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
            { header: '', render: (row) => can('MENTOR_MANAGE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>
      <StaffDialog kind="mentor" person={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
    </div>
  );
}

export function FacultyPage() {
  const { can } = useAuth();
  const query = useQuery(() => staffApi.faculty(), []);
  const assignments = useQuery(() => staffApi.assignments(), []);
  const batches = useBatches();
  const subjects = useSubjects();
  const [editing, setEditing] = useState<Faculty | 'new' | null>(null);
  const [assigning, setAssigning] = useState(false);
  const { values, set, setValues } = useForm({ facultyId: '', batchId: '', subjectId: '' });
  const { run, busy } = useAction();

  const assign = async () => {
    const saved = await run(
      () => staffApi.assign({ facultyId: Number(values.facultyId), batchId: Number(values.batchId), subjectId: Number(values.subjectId) }),
      'Faculty assigned',
    );
    if (saved) {
      setAssigning(false);
      setValues({ facultyId: '', batchId: '', subjectId: '' });
      assignments.reload();
    }
  };

  const toggle = async (id: number, value: boolean) => {
    if (await run(() => staffApi.setAssignmentActive(id, value), value ? 'Assignment activated' : 'Assignment ended')) {
      assignments.reload();
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Faculty" subtitle="Full-time and guest teachers"
        actions={can('FACULTY_MANAGE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add faculty</button>} />
      <Card>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No faculty yet"
          columns={[
            { header: 'Name', render: (row) => <span className="font-medium text-slate-800">{row.fullName}</span> },
            { header: 'Type', render: (row) => titleCase(row.facultyType) || '-' },
            { header: 'Specialisation', render: (row) => row.specialization ?? '-' },
            { header: 'Contact', render: (row) => [row.mobile, row.email].filter(Boolean).join(' · ') || '-' },
            { header: 'Login', render: (row) => row.username ?? '-' },
            { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
            { header: '', render: (row) => can('FACULTY_MANAGE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>

      <Card>
        <CardHeader title="Teaching assignments" subtitle="Which faculty teaches which subject in which batch. This also limits what they can see."
          actions={can('FACULTY_MANAGE') && <button type="button" className="btn-secondary btn-sm" onClick={() => setAssigning(true)}><Plus size={14} /> Assign</button>} />
        <DataTable rows={assignments.data} loading={assignments.loading} error={assignments.error} rowKey={(row) => row.id} empty="No assignments yet"
          columns={[
            { header: 'Faculty', render: (row) => row.faculty.name },
            { header: 'Batch', render: (row) => row.batch.name },
            { header: 'Subject', render: (row) => row.subject.name },
            { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
            { header: '', render: (row) => can('FACULTY_MANAGE') && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => toggle(row.id, !row.active)} disabled={busy}>
                {row.active ? 'End' : 'Reactivate'}
              </button>
            ) },
          ]} />
      </Card>

      <StaffDialog kind="faculty" person={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
      <Modal open={assigning} title="Assign faculty" onClose={() => setAssigning(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setAssigning(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={assign} disabled={busy || !values.facultyId || !values.batchId || !values.subjectId}>Assign</button></>}>
        <Field label="Faculty"><SelectInput value={values.facultyId} onChange={(v) => set('facultyId', v)} options={refOptions(query.data ?? [])} placeholder="Select" /></Field>
        <Field label="Batch"><SelectInput value={values.batchId} onChange={(v) => set('batchId', v)} options={refOptions(batches)} placeholder="Select" /></Field>
        <Field label="Subject">
          <SelectInput value={values.subjectId} onChange={(v) => set('subjectId', v)} placeholder="Select"
            options={subjects
              .filter((subject) => !values.batchId || subject.course.id === batches.find((b) => b.id === Number(values.batchId))?.course.id)
              .map((subject) => ({ value: subject.id, label: subject.name }))} />
        </Field>
      </Modal>
    </div>
  );
}
