import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { meetingApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, enumOptions, Field, FilterBar, numberOrUndefined, SelectInput, TextArea } from '../../components/forms';
import { Badge, Card, Modal, PageHeader } from '../../components/ui';
import { formatDate, isoDaysFromToday } from '../../utils/format';
import type { ParentMeeting } from '../../types';
import { StudentPicker } from './DisciplinePage';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'FOLLOW_UP'] as const;

export default function ParentMeetingsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-60));
  const [to, setTo] = useState(isoDaysFromToday(60));
  const query = useQuery(() => meetingApi.search({ status, from, to }), [status, from, to]);
  const [editing, setEditing] = useState<ParentMeeting | 'new' | null>(null);
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({
    batchId: '', studentId: '', meetingDate: isoDaysFromToday(0), discussion: '', academicIssues: '', attendanceIssues: '',
    disciplineIssues: '', actionItems: '', followUpDate: '', status: 'SCHEDULED',
  });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setValues({
      batchId: '',
      studentId: existing ? String(existing.student.id) : '',
      meetingDate: existing?.meetingDate ?? isoDaysFromToday(0),
      discussion: existing?.discussion ?? '',
      academicIssues: existing?.academicIssues ?? '',
      attendanceIssues: existing?.attendanceIssues ?? '',
      disciplineIssues: existing?.disciplineIssues ?? '',
      actionItems: existing?.actionItems ?? '',
      followUpDate: existing?.followUpDate ?? '',
      status: existing?.status ?? 'SCHEDULED',
    });
  }, [editing]);

  const save = async () => {
    const body = {
      studentId: numberOrUndefined(values.studentId),
      meetingDate: values.meetingDate,
      discussion: blankToUndefined(values.discussion),
      academicIssues: blankToUndefined(values.academicIssues),
      attendanceIssues: blankToUndefined(values.attendanceIssues),
      disciplineIssues: blankToUndefined(values.disciplineIssues),
      actionItems: blankToUndefined(values.actionItems),
      followUpDate: blankToUndefined(values.followUpDate),
      status: values.status,
    };
    if (await run(() => meetingApi.save(existing?.id, body), existing ? 'Meeting updated' : 'Parent meeting saved')) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Parent meetings" subtitle="Discussions with parents and agreed follow-ups"
        actions={can('PARENT_MEETING_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New meeting</button>} />
      <Card>
        <FilterBar>
          <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No meetings in this period"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.meetingDate) },
            { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
            { header: 'Parent', render: (row) => row.parent?.name ?? '-' },
            { header: 'Mentor', render: (row) => row.mentor?.name ?? '-' },
            { header: 'Discussion', render: (row) => <span className="line-clamp-2">{row.discussion ?? '-'}</span> },
            { header: 'Follow-up', render: (row) => formatDate(row.followUpDate) },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: '', render: (row) => can('PARENT_MEETING_CREATE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>
      <Modal open={editing !== null} title={existing ? `Meeting with ${existing.parent?.name ?? 'parent'}` : 'New parent meeting'} onClose={() => setEditing(null)} wide
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        {existing ? (
          <p className="mb-4 text-sm text-slate-600">Student: {existing.student.name}</p>
        ) : (
          <StudentPicker batchId={values.batchId} studentId={values.studentId} error={errors.studentId}
            onBatch={(v) => set('batchId', v)} onStudent={(v) => set('studentId', v)} />
        )}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Field label="Meeting date" error={errors.meetingDate}><input type="date" className="input" value={values.meetingDate} onChange={(e) => set('meetingDate', e.target.value)} /></Field>
          <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(STATUSES)} /></Field>
          <Field label="Follow-up date"><input type="date" className="input" value={values.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} /></Field>
        </div>
        <Field label="Discussion"><TextArea value={values.discussion} onChange={(v) => set('discussion', v)} rows={3} /></Field>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Field label="Academic issues"><TextArea value={values.academicIssues} onChange={(v) => set('academicIssues', v)} rows={2} /></Field>
          <Field label="Attendance issues"><TextArea value={values.attendanceIssues} onChange={(v) => set('attendanceIssues', v)} rows={2} /></Field>
          <Field label="Discipline issues"><TextArea value={values.disciplineIssues} onChange={(v) => set('disciplineIssues', v)} rows={2} /></Field>
        </div>
        <Field label="Action items"><TextArea value={values.actionItems} onChange={(v) => set('actionItems', v)} rows={2} /></Field>
      </Modal>
    </div>
  );
}
