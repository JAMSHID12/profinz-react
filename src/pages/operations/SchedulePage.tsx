import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { eligibilityLabel } from '../../utils/eligibility';
import { scheduleApi, syllabusApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useFacultyList, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, Notice, PageHeader } from '../../components/ui';
import { addDays, formatDate, formatDay, todayIso } from '../../utils/format';
import type { ScheduleConflict, ScheduleEntry } from '../../types';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export default function SchedulePage() {
  const { user, can } = useAuth();
  const batches = useBatches();
  const faculty = useFacultyList();
  const [from, setFrom] = useState(todayIso());
  const [batchId, setBatchId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [mine, setMine] = useState(user?.portal === 'FACULTY');
  const to = addDays(from, 6);
  const query = useQuery(() => scheduleApi.search({ from, to, batchId, facultyId, mine }), [from, batchId, facultyId, mine]);
  const [editing, setEditing] = useState<ScheduleEntry | 'new' | null>(null);

  return (
    <div>
      <PageHeader
        title="Class schedule"
        subtitle={`${formatDate(from)} - ${formatDate(to)}`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFrom(addDays(from, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
            <button type="button" className="btn-secondary" onClick={() => setFrom(todayIso())}>Today</button>
            <button type="button" className="btn-secondary" onClick={() => setFrom(addDays(from, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
            {can('SCHEDULE_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Schedule class</button>}
          </>
        }
      />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
          {can('FACULTY_VIEW') && <SelectInput value={facultyId} onChange={setFacultyId} options={refOptions(faculty)} placeholder="All faculty" />}
          {user?.facultyId && (
            <div className="flex items-center"><Checkbox checked={mine} onChange={setMine} label="Only my classes" /></div>
          )}
        </FilterBar>
        <DataTable
          rows={query.data}
          loading={query.loading}
          error={query.error}
          onRetry={query.reload}
          rowKey={(row) => row.id}
          empty="No classes in this week"
          columns={[
            { header: 'Day', render: (row) => formatDay(row.scheduleDate) },
            { header: 'Time', render: (row) => `${row.startTime} - ${row.endTime}` },
            { header: 'Batch', render: (row) => row.batch.name },
            { header: 'Subject', render: (row) => <span className="font-medium text-slate-800">{row.subject.name}</span> },
            { header: 'Topic / eligibility', render: (row) => `${row.topic?.name ?? 'No topic'} · ${eligibilityLabel(row.eligibility, row.educationCategory)}` },
            { header: 'Faculty', render: (row) => row.faculty?.name ?? <span className="text-slate-400">Not assigned</span> },
            { header: 'Room', render: (row) => row.room ?? '-' },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: '', render: (row) => can('SCHEDULE_UPDATE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]}
        />
      </Card>
      <ScheduleDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
    </div>
  );
}

function ScheduleDialog({ entry, onClose, onSaved }: { entry: ScheduleEntry | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = entry && entry !== 'new' ? entry : null;
  const batches = useBatches();
  const faculty = useFacultyList();
  const { values, set, setValues } = useForm({
    batchId: '', subjectId: '', topicId: '', facultyId: '', scheduleDate: todayIso(), startTime: '', endTime: '', room: '', notes: '', repeatWeeklyUntil: '', status: 'SCHEDULED',
  });
  const courseId = batches.find((batch) => batch.id === Number(values.batchId))?.course.id;
  const subjects = useSubjects(courseId);
  const topics = useQuery(() => syllabusApi.topics({ subjectId: values.subjectId }), [values.subjectId], Boolean(values.subjectId));
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    setErrors({});
    setConflicts(null);
    setValues({
      batchId: existing ? String(existing.batch.id) : '',
      subjectId: existing ? String(existing.subject.id) : '',
      topicId: existing?.topic ? String(existing.topic.id) : '',
      facultyId: existing?.faculty ? String(existing.faculty.id) : '',
      scheduleDate: existing?.scheduleDate ?? todayIso(),
      startTime: existing?.startTime ?? '',
      endTime: existing?.endTime ?? '',
      room: existing?.room ?? '',
      notes: existing?.notes ?? '',
      repeatWeeklyUntil: '',
      status: existing?.status ?? 'SCHEDULED',
    });
  }, [entry]);

  const body = () => ({
    batchId: numberOrUndefined(values.batchId),
    subjectId: numberOrUndefined(values.subjectId),
    topicId: numberOrUndefined(values.topicId) ?? null,
    facultyId: numberOrUndefined(values.facultyId),
    scheduleDate: values.scheduleDate,
    startTime: values.startTime,
    endTime: values.endTime,
    room: blankToUndefined(values.room),
    notes: blankToUndefined(values.notes),
    repeatWeeklyUntil: existing ? undefined : blankToUndefined(values.repeatWeeklyUntil),
    status: existing ? values.status : undefined,
  });

  const check = async () => {
    const found = await run(() => scheduleApi.conflicts(body(), existing?.id));
    if (found) setConflicts(found);
  };

  const save = async () => {
    const saved = await run<unknown>(
      () => (existing ? scheduleApi.update(existing.id, body()) : scheduleApi.create(body())),
      existing ? 'Class updated' : 'Class scheduled',
    );
    if (saved) onSaved();
  };

  return (
    <Modal open={entry !== null} title={existing ? 'Edit class' : 'Schedule a class'} onClose={onClose} wide
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-secondary" onClick={check} disabled={busy}><ShieldCheck size={15} /> Check conflicts</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button>
      </>}>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Batch" error={errors.batchId}>
          <SelectInput value={values.batchId} onChange={(v) => { set('batchId', v); set('subjectId', ''); set('topicId', ''); }} options={refOptions(batches)} placeholder="Select" />
        </Field>
        <Field label="Subject" error={errors.subjectId}>
          <SelectInput value={values.subjectId} onChange={(v) => { set('subjectId', v); set('topicId', ''); }} options={refOptions(subjects)} placeholder={courseId ? 'Select' : 'Choose a batch first'} />
        </Field>
        <Field label="Syllabus topic" hint="No topic means both categories attend." error={errors.topicId ?? topics.error ?? undefined}>
          <SelectInput value={values.topicId} onChange={v => set('topicId', v)} disabled={!values.subjectId || topics.loading} placeholder="Both categories (no topic)"
            options={(topics.data ?? []).filter(t => t.active || t.id === existing?.topic?.id).map(t => ({ value: t.id, label: t.title + ' · ' + eligibilityLabel(t.eligibility, t.educationCategory) }))} />
        </Field>
        <Field label="Faculty"><SelectInput value={values.facultyId} onChange={(v) => set('facultyId', v)} options={refOptions(faculty)} placeholder="Not assigned" /></Field>
        <Field label="Date" error={errors.scheduleDate}><input type="date" className="input" value={values.scheduleDate} onChange={(e) => set('scheduleDate', e.target.value)} /></Field>
        <Field label="Start" error={errors.startTime}><input type="time" className="input" value={values.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="End" error={errors.endTime}><input type="time" className="input" value={values.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
        <Field label="Room"><TextInput value={values.room} onChange={(v) => set('room', v)} /></Field>
        {existing ? (
          <Field label="Status"><SelectInput value={values.status} onChange={(v) => set('status', v)} options={enumOptions(STATUSES)} /></Field>
        ) : (
          <Field label="Repeat weekly until (optional)" hint="Creates the same class every week" error={errors.repeatWeeklyUntil}>
            <input type="date" className="input" value={values.repeatWeeklyUntil} onChange={(e) => set('repeatWeeklyUntil', e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Notes"><TextArea value={values.notes} onChange={(v) => set('notes', v)} rows={2} /></Field>
      {conflicts && (conflicts.length === 0 ? (
        <Notice>No conflicts - the faculty, batch and room are all free.</Notice>
      ) : (
        <Notice tone="warning">
          <p className="mb-1 font-semibold">{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {conflicts.map((conflict, index) => <li key={index}>{formatDate(conflict.date)}: {conflict.message}</li>)}
          </ul>
        </Notice>
      ))}
    </Modal>
  );
}
