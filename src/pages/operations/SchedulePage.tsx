import { SearchableSelect, DatePicker, TimeSelect } from '../../components/pickers';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, GraduationCap, MapPin, Plus, Repeat, User } from 'lucide-react';
import { eligibilityLabel } from '../../utils/eligibility';
import { scheduleApi, syllabusApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useFacultyList, useSubjects } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { blankToUndefined, Checkbox, enumOptions, Field, numberOrUndefined, refOptions, SelectInput, TextArea } from '../../components/forms';
import { Badge, Card, ErrorState, InfoGrid, Modal, PageHeader, Spinner } from '../../components/ui';
import { addDays, formatDate, nowTime, todayIso } from '../../utils/format';
import type { ScheduleEntry } from '../../types';
import { calendarRange, dateLabel, isPastStart, layoutEvents, minutes, moveMonth, timeLabel, timeValue } from './scheduleCalendar';
import type { CalendarView } from './scheduleCalendar';
import './schedule.css';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
type Draft = { date: string; time?: string };
const eventTone = (entry: ScheduleEntry) => entry.status === 'CANCELLED' ? 'cancelled' : ['blue', 'green', 'yellow', 'purple', 'pink'][entry.subject.id % 5];

function useScheduleClock() {
  const [clock, setClock] = useState(() => ({ today: todayIso(), time: nowTime() }));
  useEffect(() => {
    const refresh = () => setClock({ today: todayIso(), time: nowTime() });
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return clock;
}

export default function SchedulePage() {
  const clock = useScheduleClock();
  const { user, can } = useAuth();
  const { config } = useConfig();
  const batches = useBatches();
  const [date, setDate] = useState(todayIso());
  const [view, setView] = useState<CalendarView>('Week');
  const [batchId, setBatchId] = useState('');
  const [mine, setMine] = useState(user?.portal === 'FACULTY');
  const { from, to } = calendarRange(date, view);
  const query = useQuery(() => scheduleApi.search({ from, to, batchId, mine }), [from, to, batchId, mine]);
  const [editing, setEditing] = useState<ScheduleEntry | Draft | null>(null);
  const [details, setDetails] = useState<ScheduleEntry | null>(null);
  const year = Number(date.slice(0, 4));
  const currentYear = Number(todayIso().slice(0, 4));
  const years = Array.from({ length: Math.max(year, currentYear + 5) - Math.min(year, currentYear - 5) + 1 }, (_, i) => Math.min(year, currentYear - 5) + i);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  const entries = query.data ?? [];
  const firstHour = Math.min(8, ...entries.map(entry => Math.floor(minutes(entry.startTime) / 60)));
  const lastHour = Math.max(19, ...entries.map(entry => Math.ceil(minutes(entry.endTime) / 60)));
  const slots = Array.from({ length: (lastHour - firstHour) * 2 }, (_, i) => firstHour * 60 + i * 30);
  const heading = view === 'Month' ? dateLabel(date, { month: 'long', year: 'numeric' }) : view === 'Day' ? dateLabel(date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : `${dateLabel(from, { month: 'short', day: 'numeric', ...(from.slice(0, 4) !== to.slice(0, 4) ? { year: 'numeric' as const } : {}) })} – ${dateLabel(to, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const navigate = (direction: number) => setDate(view === 'Month' ? moveMonth(date, direction) : addDays(date, direction * (view === 'Week' ? 7 : 1)));
  const openEntry = (entry: ScheduleEntry) => can('SCHEDULE_UPDATE') && !isPastStart(entry.scheduleDate, entry.startTime, todayIso(), nowTime()) ? setEditing(entry) : setDetails(entry);
  const newClass = (day: string, time?: string) => { if (can('SCHEDULE_CREATE') && !isPastStart(day, time, todayIso(), nowTime())) setEditing({ date: day, time }); };
  const timezone = new Intl.DateTimeFormat('en', { timeZone: config.client.timezone, timeZoneName: 'longOffset' }).formatToParts(new Date(`${date}T12:00:00Z`)).find(part => part.type === 'timeZoneName')?.value;
  const renderEvent = (entry: ScheduleEntry, compact = false) => <>
    <span className="schedule-event-time">{entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}</span>
    <strong>{entry.subject.name}</strong>
    {!compact && <div className={`schedule-event-meta ${minutes(entry.endTime) - minutes(entry.startTime) <= 90 ? 'short-event-meta' : ''}`}><span>{entry.faculty?.name ?? 'Not assigned'}</span><span className="schedule-event-room"><MapPin size={13} /> {entry.room ? (/^room\b/i.test(entry.room) ? entry.room : `Room ${entry.room}`) : 'No room assigned'}</span></div>}
    {entry.status !== 'SCHEDULED' && <span className="schedule-event-status">{entry.status.toLowerCase()}</span>}
  </>;

  return (
    <div className="schedule-page">
      <PageHeader title="Class schedule" actions={can('SCHEDULE_CREATE') && <button type="button" className="btn-primary" onClick={() => newClass(isPastStart(date, undefined, todayIso(), nowTime()) ? (nowTime() === '23:59' ? addDays(todayIso(), 1) : todayIso()) : date)}><Plus size={19} /> Schedule class</button>} />
      <Card className="schedule-filters">
        <Field label="Batch" className="mb-0"><SearchableSelect aria-label="Batch filter" value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" /></Field>
        <Field label="Year" className="mb-0"><SelectInput aria-label="Year" value={year} onChange={value => setDate(moveMonth(date, (Number(value) - year) * 12))} options={years.map(value => ({ value, label: String(value) }))} /></Field>
        {user?.facultyId && <Checkbox checked={mine} onChange={setMine} label="Only my classes" />}
      </Card>
      <Card className="schedule-calendar">
        <div className="schedule-toolbar">
          <button type="button" className="btn-secondary schedule-today" onClick={() => setDate(todayIso())}>Today</button>
          <div className="schedule-navigation">
            <button type="button" onClick={() => navigate(-1)} aria-label={`Previous ${view.toLowerCase()}`}><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => navigate(1)} aria-label={`Next ${view.toLowerCase()}`}><ChevronRight size={18} /></button>
          </div>
          <h2 aria-live="polite">{heading}</h2>
          <div className="schedule-view-switch" aria-label="Calendar view">
            {(['Month', 'Week', 'Day'] as const).map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>{option}</button>)}
          </div>
        </div>
        {query.loading ? <Spinner label="Loading classes" /> : query.error ? <ErrorState message={query.error} onRetry={query.reload} /> : <>
          {entries.length === 0 && <p className="schedule-empty" role="status">No classes in this {view.toLowerCase()}.{can('SCHEDULE_CREATE') ? ' Select a time or use Schedule class to add one.' : ''}</p>}
          <div className="schedule-calendar-scroll">
            {view === 'Month' ? <div className="schedule-month">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="schedule-month-weekday" key={day}>{day}</div>)}
              {days.map(day => <div key={day} className={`schedule-month-day ${day.slice(0, 7) !== date.slice(0, 7) ? 'outside-month' : ''} ${day === todayIso() ? 'is-today' : ''}`}>
                <div className="schedule-month-date"><button type="button" aria-label={`View ${formatDate(day)}`} onClick={() => { setDate(day); setView('Day'); }}>{Number(day.slice(8))}</button>{can('SCHEDULE_CREATE') && <button type="button" disabled={isPastStart(day, undefined, clock.today, clock.time)} title={day < todayIso() ? 'Past dates cannot be scheduled' : undefined} aria-label={`Schedule class on ${formatDate(day)}`} onClick={() => newClass(day)}><Plus size={14} /></button>}</div>
                {entries.filter(entry => entry.scheduleDate === day).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(entry => <button type="button" key={entry.id} className={`schedule-event month-event tone-${eventTone(entry)}`} onClick={() => openEntry(entry)}>{renderEvent(entry, true)}</button>)}
              </div>)}
            </div> : <div className={`schedule-time-grid ${view === 'Day' ? 'day-view' : ''}`} style={{ gridTemplateColumns: `76px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="schedule-zone" title={config.client.timezone}>{timezone}</div>
              {days.map(day => <button type="button" key={day} className={`schedule-day-heading ${day === todayIso() ? 'is-today' : ''}`} onClick={() => { setDate(day); setView('Day'); }}><span>{dateLabel(day, { weekday: 'short' })}</span><span>{dateLabel(day, { month: 'short', day: 'numeric' })}</span></button>)}
              <div className="schedule-time-labels" style={{ height: slots.length * 30 }}>{slots.filter(slot => slot % 60 === 0).map(slot => <span key={slot} style={{ top: slot - firstHour * 60 }}>{timeLabel(slot)}</span>)}</div>
              {days.map(day => <div key={day} className={`schedule-day-column ${day === todayIso() ? 'is-today' : ''}`} style={{ height: slots.length * 30 }}>
                {slots.map(slot => <button type="button" className="schedule-slot" key={slot} disabled={!can('SCHEDULE_CREATE') || isPastStart(day, timeValue(slot), clock.today, clock.time)} aria-label={`Schedule class on ${formatDate(day)} at ${timeLabel(slot)}`} onClick={() => newClass(day, timeValue(slot))} />)}
                {layoutEvents(entries.filter(entry => entry.scheduleDate === day)).map(({ entry, column, columns }) => <button type="button" key={entry.id} className={`schedule-event tone-${eventTone(entry)}`} style={{ top: minutes(entry.startTime) - firstHour * 60, height: Math.max(18, minutes(entry.endTime) - minutes(entry.startTime) - 3), left: `calc(${column / columns * 100}% + 4px)`, width: `calc(${100 / columns}% - 7px)` }} onClick={() => openEntry(entry)} aria-label={`${entry.subject.name}, ${entry.startTime.slice(0, 5)} to ${entry.endTime.slice(0, 5)}, ${entry.faculty?.name ?? 'Not assigned'}, ${entry.room ?? 'No room'}, ${entry.status}`} title={`${entry.subject.name} · ${entry.batch.name} · ${entry.faculty?.name ?? 'Not assigned'} · ${entry.room ?? 'No room'} · ${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`}>{renderEvent(entry)}</button>)}
              </div>)}
            </div>}
          </div>
        </>}
      </Card>
      {editing && <ScheduleDialog rooms={[...new Set(entries.map(entry => entry.room).filter((room): room is string => !!room))]} entry={editing} batchId={batchId} onClose={() => setEditing(null)} onSaved={savedDate => { setDate(savedDate); setEditing(null); query.reload(); }} />}
      <Modal open={details !== null} title="Class details" onClose={() => setDetails(null)} dismissible footer={<button type="button" className="btn-secondary" onClick={() => setDetails(null)}>Close</button>}>
        {details && <InfoGrid items={[
          ['Subject', details.subject.name], ['Batch', details.batch.name], ['Date', formatDate(details.scheduleDate)], ['Time', `${details.startTime.slice(0, 5)} – ${details.endTime.slice(0, 5)}`],
          ['Faculty', details.faculty?.name], ['Room', details.room], ['Syllabus topic', details.topic?.name ?? 'No topic'], ['Eligibility', eligibilityLabel(details.eligibility, details.educationCategory)], ['Status', <Badge value={details.status} />], ['Notes', details.notes],
        ]} />}
      </Modal>
    </div>
  );
}

function FormRow({ label, icon, children, error, hint }: { label: string; icon: ReactNode; children: ReactNode; error?: string; hint?: string }) {
  return <div className="schedule-form-row"><div className="schedule-form-label">{icon}<span>{label}</span></div><div className="min-w-0">{children}{error ? <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p> : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div></div>;
}

function ScheduleDialog({ entry, batchId, onClose, onSaved, rooms }: { rooms: string[]; entry: ScheduleEntry | Draft; batchId: string; onClose: () => void; onSaved: (date: string) => void }) {
  const clock = useScheduleClock();
  const existing = 'id' in entry ? entry : null;
  const draft = 'date' in entry ? entry : null;
  const batches = useBatches();
  const faculty = useFacultyList();
  const { values, set } = useForm({
    batchId: existing ? String(existing.batch.id) : batchId, subjectId: existing ? String(existing.subject.id) : '', topicId: existing?.topic ? String(existing.topic.id) : '', facultyId: existing?.faculty ? String(existing.faculty.id) : '',
    scheduleDate: existing?.scheduleDate ?? draft?.date ?? todayIso(), startTime: existing?.startTime.slice(0, 5) ?? draft?.time ?? '', endTime: existing?.endTime.slice(0, 5) ?? (draft?.time ? timeValue(Math.min(minutes(draft.time) + 60, 1439)) : ''),
    room: existing?.room ?? '', notes: existing?.notes ?? '', repeatWeeklyUntil: '', status: existing?.status ?? 'SCHEDULED',
  });
  const courseId = batches.find(batch => batch.id === Number(values.batchId))?.course.id;
  const subjects = useSubjects(courseId);
  const topics = useQuery(() => syllabusApi.topics({ subjectId: values.subjectId }), [values.subjectId], Boolean(values.subjectId));
  const { run, busy, errors, setErrors } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  useEffect(() => {
    const form = formRef.current;
    const previous = document.activeElement as HTMLElement | null;
    form?.querySelector<HTMLElement>('button[role="combobox"], select, input:not([aria-hidden="true"])')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[data-radix-popper-content-wrapper]')) return;
      if (event.key === 'Escape' && !saving.current) onClose();
      if (event.key !== 'Tab') return;
      const dialog = form?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([aria-hidden="true"]), select:not(:disabled), textarea:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  const save = async () => {
    if (saving.current) return;
    const validation: Record<string, string> = {};
    if (values.scheduleDate < todayIso()) validation.scheduleDate = 'Classes cannot be scheduled on a past date.';
    if (values.scheduleDate === todayIso() && values.startTime && isPastStart(values.scheduleDate, values.startTime, todayIso(), nowTime())) validation.startTime = 'Choose a start time later than the current time.';
    if (values.endTime <= values.startTime) validation.endTime = 'End time must be after start time.';
    if (values.repeatWeeklyUntil && values.repeatWeeklyUntil < values.scheduleDate) validation.repeatWeeklyUntil = 'Choose a date on or after the first class.';
    if (Object.keys(validation).length) { setErrors(validation); return; }
    const body = {
      batchId: numberOrUndefined(values.batchId), subjectId: numberOrUndefined(values.subjectId), topicId: numberOrUndefined(values.topicId) ?? null, facultyId: numberOrUndefined(values.facultyId),
      scheduleDate: values.scheduleDate, startTime: values.startTime, endTime: values.endTime, room: blankToUndefined(values.room), notes: blankToUndefined(values.notes),
      repeatWeeklyUntil: existing ? undefined : blankToUndefined(values.repeatWeeklyUntil), status: existing ? values.status : undefined,
    };
    saving.current = true;
    const saved = await run<unknown>(() => existing ? scheduleApi.update(existing.id, body) : scheduleApi.create(body), existing ? 'Class updated' : 'Class scheduled');
    saving.current = false;
    if (saved) onSaved(values.scheduleDate);
  };
  return <Modal open title={existing ? 'Edit class' : 'Schedule a class'} onClose={() => { if (!saving.current) onClose(); }} wide className="schedule-dialog" footer={<>
    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="submit" form="schedule-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
  </>}>
    <form id="schedule-form" ref={formRef} onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="space-y-3">
        <FormRow label="Batch" icon={<GraduationCap size={21} />} error={errors.batchId}><SearchableSelect aria-label="Batch" required value={values.batchId} onChange={v => { set('batchId', v); set('subjectId', ''); set('topicId', ''); }} options={refOptions(batches)} placeholder="Select batch" /></FormRow>
        <FormRow label="Subject" icon={<BookOpen size={21} />} error={errors.subjectId}><SearchableSelect aria-label="Subject" required disabled={!courseId} value={values.subjectId} onChange={v => { set('subjectId', v); set('topicId', ''); }} options={refOptions(subjects.filter(subject => subject.course.id === courseId))} placeholder={courseId ? 'Select subject' : 'Choose a batch first'} /></FormRow>
        <FormRow label="Syllabus topic" icon={<FileText size={21} />} hint="No topic means both categories attend." error={errors.topicId ?? topics.error ?? undefined}><SearchableSelect aria-label="Syllabus topic" value={values.topicId} onChange={v => set('topicId', v)} disabled={!values.subjectId || topics.loading} placeholder="Both categories (no topic)" options={(topics.data ?? []).filter(t => t.subject.id === Number(values.subjectId) && (t.active || t.id === existing?.topic?.id)).map(t => ({ value: t.id, label: `${t.title} · ${eligibilityLabel(t.eligibility, t.educationCategory)}` }))} /></FormRow>
        <FormRow label="Faculty" icon={<User size={21} />} error={errors.facultyId}><SearchableSelect aria-label="Faculty" value={values.facultyId} onChange={v => set('facultyId', v)} options={refOptions(faculty)} placeholder="Not assigned" /></FormRow>
        <FormRow label="Date" icon={<CalendarDays size={21} />} error={errors.scheduleDate}><DatePicker aria-label="Date" min={todayIso()} required className="input" value={values.scheduleDate} onChange={e => set('scheduleDate', e.target.value)} /></FormRow>
        <FormRow label="Start time" icon={<Clock size={21} />} error={errors.startTime ?? errors.endTime}><div className="schedule-time-fields"><TimeSelect aria-label="Start time" min={values.scheduleDate === clock.today ? timeValue(Math.min(minutes(clock.time) + 1, 1439)) : undefined} required className="input" value={values.startTime} onChange={e => set('startTime', e.target.value)} /><label htmlFor="schedule-end-time"><Clock size={21} /> End time</label><TimeSelect id="schedule-end-time" required className="input" value={values.endTime} onChange={e => set('endTime', e.target.value)} /></div></FormRow>
        <FormRow label="Room" icon={<MapPin size={21} />} error={errors.room}><SearchableSelect allowCustom options={[...new Set([...rooms, values.room].filter(Boolean))].map(room => ({ value: room, label: room }))} aria-label="Room" value={values.room} onChange={v => set('room', v)} placeholder="Enter room" /></FormRow>
        {existing ? <FormRow label="Status" icon={<CalendarDays size={21} />} error={errors.status}><SelectInput aria-label="Status" value={values.status} onChange={v => set('status', v as ScheduleEntry['status'])} options={enumOptions(STATUSES)} /></FormRow> : <FormRow label="Repeat weekly until (optional)" icon={<Repeat size={21} />} hint="Creates the same class every week." error={errors.repeatWeeklyUntil}><DatePicker aria-label="Repeat weekly until" className="input" min={values.scheduleDate} value={values.repeatWeeklyUntil} onChange={e => set('repeatWeeklyUntil', e.target.value)} /></FormRow>}
        <FormRow label="Notes" icon={<FileText size={21} />} error={errors.notes}><div className="schedule-notes"><TextArea aria-label="Notes" value={values.notes} onChange={v => set('notes', v)} rows={3} maxLength={500} placeholder="Add any additional notes (optional)…" /><span>{values.notes.length}/500</span></div></FormRow>
      </fieldset>
    </form>
  </Modal>;
}
