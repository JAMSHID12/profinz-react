import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { scheduleApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useFacultyList } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Card, Modal, PageHeader } from '../../components/ui';
import { formatDate, isoDaysFromToday, todayIso } from '../../utils/format';
import type { EntryExit } from '../../types';

/** What was actually taught in each class. */
export function ClassRegisterPage() {
  const { user, can } = useAuth();
  const [from, setFrom] = useState(isoDaysFromToday(-30));
  const [to, setTo] = useState(todayIso());
  const [mine, setMine] = useState(Boolean(user?.facultyId));
  const query = useQuery(() => scheduleApi.register({ from, to, mine }), [from, to, mine]);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(todayIso());
  const classes = useQuery(() => scheduleApi.search({ from: day, to: day, mine: Boolean(user?.facultyId) }), [day, open], open);
  const { values, set, setValues } = useForm({ scheduleId: '', actualStart: '', actualEnd: '', topicCovered: '', studentCount: '', remarks: '' });
  const { run, busy, errors } = useAction();

  const pickClass = (id: string) => {
    const entry = classes.data?.find((item) => item.id === Number(id));
    setValues({ ...values, scheduleId: id, actualStart: entry?.startTime ?? '', actualEnd: entry?.endTime ?? '' });
  };

  const save = async () => {
    const saved = await run(() => scheduleApi.recordRegister({
      scheduleId: numberOrUndefined(values.scheduleId),
      actualStart: values.actualStart,
      actualEnd: values.actualEnd,
      topicCovered: values.topicCovered,
      studentCount: numberOrUndefined(values.studentCount),
      remarks: blankToUndefined(values.remarks),
    }), 'Class register saved');
    if (saved) {
      setOpen(false);
      setValues({ scheduleId: '', actualStart: '', actualEnd: '', topicCovered: '', studentCount: '', remarks: '' });
      query.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Class register" subtitle="Topic covered and actual timings of each class"
        actions={can('CLASS_REGISTER_CREATE') && <button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Record class</button>} />
      <Card>
        <FilterBar>
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          {user?.facultyId && <div className="flex items-center"><Checkbox checked={mine} onChange={setMine} label="Only my classes" /></div>}
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
          empty="No classes recorded in this period"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.schedule.scheduleDate) },
            { header: 'Class', render: (row) => `${row.schedule.subject.name} · ${row.schedule.batch.name}` },
            { header: 'Faculty', render: (row) => row.faculty?.name ?? '-' },
            { header: 'Time', render: (row) => `${row.actualStart} - ${row.actualEnd}` },
            { header: 'Topic covered', render: (row) => <span className="text-slate-800">{row.topicCovered}</span> },
            { header: 'Students', render: (row) => row.studentCount ?? '-' },
          ]} />
      </Card>
      <Modal open={open} title="Record a class" onClose={() => setOpen(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy || !values.scheduleId}>Save</button></>}>
        <Field label="Date"><input type="date" className="input" value={day} max={todayIso()} onChange={(event) => setDay(event.target.value)} /></Field>
        <Field label="Class" error={errors.scheduleId}>
          <SelectInput value={values.scheduleId} onChange={pickClass} placeholder={classes.data?.length === 0 ? 'No classes on this day' : 'Select'}
            options={(classes.data ?? []).map((entry) => ({ value: entry.id, label: `${entry.startTime}-${entry.endTime} ${entry.subject.name} (${entry.batch.name})` }))} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Actual start" error={errors.actualStart}><input type="time" className="input" value={values.actualStart} onChange={(e) => set('actualStart', e.target.value)} /></Field>
          <Field label="Actual end" error={errors.actualEnd}><input type="time" className="input" value={values.actualEnd} onChange={(e) => set('actualEnd', e.target.value)} /></Field>
        </div>
        <Field label="Topic covered" error={errors.topicCovered}><TextArea value={values.topicCovered} onChange={(v) => set('topicCovered', v)} rows={2} /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Students present" error={errors.studentCount}><TextInput value={values.studentCount} onChange={(v) => set('studentCount', v)} inputMode="numeric" /></Field>
          <Field label="Remarks"><TextInput value={values.remarks} onChange={(v) => set('remarks', v)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/** Faculty arrival and departure times per session. */
export function FacultyEntryExitPage() {
  const { user, can } = useAuth();
  const faculty = useFacultyList();
  const [from, setFrom] = useState(isoDaysFromToday(-14));
  const [to, setTo] = useState(todayIso());
  const [facultyId, setFacultyId] = useState('');
  const query = useQuery(() => scheduleApi.entries({ from, to, facultyId }), [from, to, facultyId]);
  const [editing, setEditing] = useState<EntryExit | 'new' | null>(null);
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({ facultyId: '', entryDate: todayIso(), sessionLabel: '', entryTime: '', exitTime: '', remarks: '' });
  const { run, busy, errors, setErrors } = useAction();
  const recordsForOthers = can('FACULTY_VIEW') && !user?.facultyId;

  useEffect(() => {
    setErrors({});
    setValues({
      facultyId: existing ? String(existing.faculty.id) : '',
      entryDate: existing?.entryDate ?? todayIso(),
      sessionLabel: existing?.sessionLabel ?? '',
      entryTime: existing?.entryTime ?? '',
      exitTime: existing?.exitTime ?? '',
      remarks: existing?.remarks ?? '',
    });
  }, [editing]);

  const save = async () => {
    const body = {
      facultyId: numberOrUndefined(values.facultyId),
      entryDate: values.entryDate,
      sessionLabel: values.sessionLabel,
      entryTime: values.entryTime,
      exitTime: blankToUndefined(values.exitTime),
      remarks: blankToUndefined(values.remarks),
    };
    if (await run(() => scheduleApi.saveEntry(existing?.id, body), existing ? 'Entry updated' : 'Entry recorded')) {
      setEditing(null);
      query.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Faculty entry and exit"
        actions={can('FACULTY_ENTRY_EXIT_CREATE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Record entry</button>} />
      <Card>
        <FilterBar>
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          {can('FACULTY_VIEW') && <SelectInput value={facultyId} onChange={setFacultyId} options={refOptions(faculty)} placeholder="All faculty" />}
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
          empty="No entries in this period"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.entryDate) },
            { header: 'Faculty', render: (row) => <span className="font-medium text-slate-800">{row.faculty.name}</span> },
            { header: 'Session', render: (row) => row.sessionLabel },
            { header: 'In', render: (row) => row.entryTime },
            { header: 'Out', render: (row) => row.exitTime ?? <span className="text-amber-600">Not recorded</span> },
            { header: 'Remarks', render: (row) => row.remarks ?? '' },
            { header: '', render: (row) => can('FACULTY_ENTRY_EXIT_CREATE') && (
              <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
            ) },
          ]} />
      </Card>
      <Modal open={editing !== null} title={existing ? 'Update entry' : 'Record entry'} onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        {recordsForOthers && (
          <Field label="Faculty" error={errors.facultyId}>
            <SelectInput value={values.facultyId} onChange={(v) => set('facultyId', v)} options={refOptions(faculty)} placeholder="Select" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Date" error={errors.entryDate}><input type="date" className="input" value={values.entryDate} onChange={(e) => set('entryDate', e.target.value)} /></Field>
          <Field label="Session" error={errors.sessionLabel}><TextInput value={values.sessionLabel} onChange={(v) => set('sessionLabel', v)} placeholder="Evening" /></Field>
          <Field label="Entry time" error={errors.entryTime}><input type="time" className="input" value={values.entryTime} onChange={(e) => set('entryTime', e.target.value)} /></Field>
          <Field label="Exit time" error={errors.exitTime}><input type="time" className="input" value={values.exitTime} onChange={(e) => set('exitTime', e.target.value)} /></Field>
        </div>
        <Field label="Remarks"><TextInput value={values.remarks} onChange={(v) => set('remarks', v)} /></Field>
      </Modal>
    </div>
  );
}
