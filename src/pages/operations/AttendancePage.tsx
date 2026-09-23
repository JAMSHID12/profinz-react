import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpDown,
  BellOff,
  CalendarX2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Loader2,
  Save,
  Search,
  Shirt,
  X,
} from 'lucide-react';
import { attendanceApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '../../hooks/useQuery';
import { EmptyState, ErrorState, Modal, Spinner } from '../../components/ui';
import {
  ATTENDANCE_STATUSES,
  choose,
  MARKING_STATUSES,
  MarkDetails,
  MarkEditor,
  markingStatus,
  STATUS_STYLE,
  StudentAvatar,
  withStatus,
} from '../../components/attendance';
import { addDays, formatDate, formatDateTime, formatDay, nowTime, ROLE_LABELS, todayIso } from '../../utils/format';
import type { AttendanceMark, AttendanceSheet, AttendanceStatus, BulkResult, SheetRow, TakerClass } from '../../types';

type Marks = Record<number, AttendanceMark>;
type Filter = 'ALL' | 'PRESENT' | 'ABSENT' | 'DISCIPLINE';
type Marking = 'PRESENT' | 'ABSENT';
type Sort = 'name' | 'admission' | 'absent';

/** Phones show a coloured letter instead of dot + word, and leave out Discipline, so the chips fit on one line. */
/** Present counts late students too (late is part of present); Discipline is late, no uniform or no ID tag. */
const FILTERS: { value: Filter; label: string; short: ReactNode; dot?: string; letter?: string }[] = [
  { value: 'ALL', label: 'All', short: 'All' },
  { value: 'PRESENT', label: 'Present', short: 'P', dot: 'bg-emerald-500', letter: 'max-sm:text-emerald-600' },
  { value: 'ABSENT', label: 'Absent', short: 'A', dot: 'bg-rose-500', letter: 'max-sm:text-rose-600' },
  { value: 'DISCIPLINE', label: 'Discipline', short: <Shirt size={13} /> },
];

function hasDiscipline(mark: AttendanceMark): boolean {
  return mark.status === 'LATE' || mark.noUniform || mark.noIdTag;
}

const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'admission', label: 'Admission no.' },
  { value: 'absent', label: 'Absent first' },
];

const SORT_RANK: Record<AttendanceStatus, number> = { ABSENT: 0, LATE: 1, EXCUSED: 2, PRESENT: 3 };

/** Desktop columns: student, details, status, more. Shared by the column header and every row so they line up. */
const DESKTOP_COLUMNS = 'lg:grid-cols-[minmax(12rem,18rem)_minmax(8rem,1fr)_10rem_2.25rem]';
const SORT_KEY = 'tmp.attendanceSort';
const DRAFT_PREFIX = 'tmp.attendanceDraft.';

// ---- Marks and drafts -----------------------------------------------------------------------------

/** Rows never saved start as present, so a class where everyone came is one tap: Save. */
function marksFrom(rows: SheetRow[]): Marks {
  const marks: Marks = {};
  for (const row of rows) {
    marks[row.studentId] = {
      status: row.status ?? 'PRESENT',
      lateMinutes: row.lateMinutes,
      absenceReason: row.absenceReason,
      noUniform: row.noUniform,
      noIdTag: row.noIdTag,
      remarks: row.remarks,
    };
  }
  return marks;
}

function sameMark(a: AttendanceMark, b: AttendanceMark): boolean {
  return a.status === b.status && a.lateMinutes === b.lateMinutes && a.absenceReason === b.absenceReason
    && a.noUniform === b.noUniform && a.noIdTag === b.noIdTag && (a.remarks ?? '') === (b.remarks ?? '');
}

/**
 * Unsaved marks are kept in this tab's session storage, so a failed save, an expired session or a
 * reload never costs the teacher their work. Only students whose mark was changed are stored.
 */
function readDraft(key: string, baseline: Marks): Marks {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as Record<string, Partial<AttendanceMark>> | null;
    if (!stored || typeof stored !== 'object') return baseline;
    const marks = { ...baseline };
    for (const [id, mark] of Object.entries(stored)) {
      const studentId = Number(id);
      if (!marks[studentId] || !mark?.status || !ATTENDANCE_STATUSES.includes(mark.status)) continue;
      marks[studentId] = withStatus({
        status: mark.status,
        lateMinutes: typeof mark.lateMinutes === 'number' ? mark.lateMinutes : undefined,
        absenceReason: mark.absenceReason,
        noUniform: Boolean(mark.noUniform),
        noIdTag: Boolean(mark.noIdTag),
        remarks: typeof mark.remarks === 'string' ? mark.remarks : undefined,
      }, mark.status);
    }
    return marks;
  } catch {
    return baseline;
  }
}

function writeDraft(key: string, marks: Marks, changed: Set<number>) {
  try {
    if (changed.size === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    const draft: Marks = {};
    changed.forEach((studentId) => {
      draft[studentId] = marks[studentId];
    });
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the marks are still on screen.
  }
}

function readSort(): Sort {
  try {
    const stored = window.localStorage.getItem(SORT_KEY);
    return SORTS.some((option) => option.value === stored) ? (stored as Sort) : 'name';
  } catch {
    return 'name';
  }
}

// ---- Choosing what to take ------------------------------------------------------------------------

function isWholeDay(entry: TakerClass): boolean {
  return entry.scheduleId === undefined || entry.scheduleId === null;
}

function classLabel(entry: TakerClass): string {
  const taken = entry.marked > 0 ? '  ✓' : '';
  if (isWholeDay(entry)) return `${entry.batch.name} · whole day${taken}`;
  return `${entry.subject?.name ?? 'Class'} · ${entry.startTime}–${entry.endTime} · ${entry.batch.name}${taken}`;
}

interface LastChoice {
  batchId: number;
  subjectId?: number;
}

/**
 * What to open without asking: the same batch and subject as before a date change; otherwise a
 * mentor's first register not yet taken, or the faculty member's class that is on now (or the
 * latest one started and not taken, or the next one).
 */
function pickDefault(entries: TakerClass[], isToday: boolean, last: LastChoice | null): TakerClass | undefined {
  if (entries.length === 0) return undefined;
  if (last) {
    const same = entries.find((entry) => entry.batch.id === last.batchId
      && (last.subjectId === undefined ? isWholeDay(entry) : entry.subject?.id === last.subjectId));
    if (same) return same;
  }
  const days = entries.filter(isWholeDay);
  if (days.length > 0) return days.find((entry) => entry.marked === 0) ?? days[0];
  if (isToday) {
    const now = nowTime();
    const current = entries.find((entry) => entry.startTime! <= now && now < entry.endTime!);
    if (current) return current;
    const started = entries.filter((entry) => entry.startTime! <= now);
    const lastStarted = started[started.length - 1];
    if (lastStarted && lastStarted.marked === 0) return lastStarted;
    return entries.find((entry) => entry.startTime! > now) ?? lastStarted ?? entries[0];
  }
  return entries.find((entry) => entry.marked === 0) ?? entries[0];
}

// ---- Screen ---------------------------------------------------------------------------------------

/**
 * Taking attendance - for mentors (their batches, whole day or any class) and faculty (the
 * classes they teach). Everyone starts as present, one tap marks an exception, and the whole
 * register is saved in one request. The header and the Save bar stay put; only the list scrolls.
 */
export default function AttendancePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = todayIso();
  const requestedDate = params.get('date');
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  const batchId = Number(params.get('batchId')) || undefined;
  const scheduleId = Number(params.get('scheduleId')) || undefined;

  const classes = useQuery(() => attendanceApi.classes(date).then((entries) => ({ date, entries })), [date]);
  const entries = classes.data?.date === date ? classes.data.entries : null;
  const selected = entries?.find((entry) => entry.batch.id === batchId && (entry.scheduleId ?? undefined) === scheduleId);

  const lastChoice = useRef<LastChoice | null>(null);
  useEffect(() => {
    if (selected) lastChoice.current = { batchId: selected.batch.id, subjectId: selected.subject?.id };
  }, [selected]);

  const open = useCallback((nextDate: string, entry?: TakerClass) => {
    const next = new URLSearchParams();
    if (nextDate !== todayIso()) next.set('date', nextDate);
    if (entry) {
      next.set('batchId', String(entry.batch.id));
      if (!isWholeDay(entry)) next.set('scheduleId', String(entry.scheduleId));
    }
    setParams(next, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (!entries || selected) return;
    const fallback = pickDefault(entries, date === today, lastChoice.current);
    if (fallback) open(date, fallback);
  }, [entries, selected, date, today, open]);

  const sheetQuery = useQuery(
    () => attendanceApi.sheet(selected!.batch.id, date, selected!.scheduleId ?? undefined),
    [selected?.batch.id, selected?.scheduleId, date],
    Boolean(selected),
  );
  const loaded = sheetQuery.data;
  const sheet = loaded && selected && loaded.batch.id === selected.batch.id && loaded.date === date
    && (loaded.schedule?.id ?? undefined) === (selected.scheduleId ?? undefined) ? loaded : null;

  const changeDate = (next: string) => {
    if (next && next <= today) open(next);
  };

  const roles = user?.roles.filter((role) => role === 'MENTORS' || role === 'FACULTY') ?? [];
  const taker = `${user?.fullName ?? ''}${roles.length ? ` (${roles.map((role) => ROLE_LABELS[role]).join(', ')})` : ''}`;

  let body: ReactNode;
  if (!entries) {
    body = classes.error ? <Centered><ErrorState message={classes.error} onRetry={classes.reload} /></Centered> : <Centered><Spinner /></Centered>;
  } else if (entries.length === 0) {
    body = (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-2 px-6 text-center">
          <CalendarX2 size={28} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">Nothing to take {date === today ? 'today' : `on ${formatDate(date)}`}</p>
          <p className="text-sm text-slate-500">
            {roles.includes('MENTORS') ? 'Registers appear for the active batches you mentor. ' : ''}
            {roles.includes('FACULTY') ? 'Classes appear when you teach them on this date.' : ''}
          </p>
          <button type="button" className="btn-secondary btn-sm mt-1" onClick={() => changeDate(addDays(date, -1))}>
            <ChevronLeft size={14} /> Previous day
          </button>
        </div>
      </Centered>
    );
  } else if (!selected || (!sheet && !sheetQuery.error)) {
    body = <Centered><Spinner label="Loading students" /></Centered>;
  } else if (!sheet) {
    body = <Centered><ErrorState message={sheetQuery.error!} onRetry={sheetQuery.reload} /></Centered>;
  } else {
    body = (
      <SheetEditor
        key={`${date}:${selected.batch.id}:${selected.scheduleId ?? 'day'}`}
        sheet={sheet}
        userId={user?.id ?? 0}
        taker={taker}
        onSaved={classes.reload}
      />
    );
  }

  const wholeDays = entries?.filter(isWholeDay) ?? [];
  const lessons = entries?.filter((entry) => !isWholeDay(entry)) ?? [];
  const option = (entry: TakerClass) => (
    <option key={`${entry.batch.id}:${entry.scheduleId ?? 'day'}`} value={`${entry.batch.id}:${entry.scheduleId ?? ''}`}>
      {classLabel(entry)}
    </option>
  );

  return (
    <div className="screen-fill flex flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <h1 className="hidden shrink-0 pr-2 text-base font-semibold text-slate-900 xl:block">Attendance</h1>
          <select
            className="input h-10 min-w-0 flex-1 py-0 font-medium sm:max-w-md"
            aria-label="Batch or class"
            disabled={!entries || entries.length === 0}
            value={selected ? `${selected.batch.id}:${selected.scheduleId ?? ''}` : ''}
            onChange={(event) => {
              const [batch, schedule] = event.target.value.split(':');
              const entry = entries?.find((candidate) => String(candidate.batch.id) === batch
                && String(candidate.scheduleId ?? '') === schedule);
              if (entry) open(date, entry);
            }}
          >
            {!selected && <option value="">{entries && entries.length === 0 ? 'No classes on this date' : 'Loading…'}</option>}
            {wholeDays.length > 0 && lessons.length > 0 ? (
              <>
                <optgroup label="Whole day">{wholeDays.map(option)}</optgroup>
                <optgroup label="Classes">{lessons.map(option)}</optgroup>
              </>
            ) : (entries ?? []).map(option)}
          </select>
          <DateStepper date={date} today={today} onChange={changeDate} />
        </div>
        {selected && (
          <p className="mt-1 hidden truncate text-xs text-slate-500 sm:block">
            <span className="font-medium text-slate-700">{selected.batch.name}</span>
            {isWholeDay(selected)
              ? ' · Whole day'
              : ` · ${selected.subject?.name} · ${selected.startTime}–${selected.endTime}${selected.room ? ` · ${selected.room}` : ''}${selected.faculty ? ` · ${selected.faculty.name}` : ''}`}
            {` · ${selected.students} students`}
          </p>
        )}
      </div>
      {body}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">{children}</div>;
}

function DateStepper({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const relative = date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : null;
  return (
    <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white">
      <button type="button" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day"
        className="flex w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50">
        <ChevronLeft size={18} />
      </button>
      <label className="relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-x border-slate-200 px-2.5 text-sm transition hover:bg-slate-50">
        <span className="font-semibold text-slate-800">{relative ?? formatDay(date)}</span>
        {relative && <span className="hidden text-slate-500 sm:inline">&bull; {formatDate(date)}</span>}
        <input
          type="date"
          required
          value={date}
          max={today}
          aria-label="Date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker();
            } catch {
              // Older browsers open their own picker.
            }
          }}
        />
      </label>
      <button type="button" onClick={() => onChange(addDays(date, 1))} disabled={date >= today} aria-label="Next day"
        className="flex w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ---- The register -----------------------------------------------------------------------------------

function SheetEditor({ sheet, userId, taker, onSaved }: { sheet: AttendanceSheet; userId: number; taker: string; onSaved: () => void }) {
  const rows = sheet.rows;
  const draftKey = `${DRAFT_PREFIX}${userId}.${sheet.batch.id}.${sheet.date}.${sheet.schedule?.id ?? 'day'}`;

  const [baseline, setBaseline] = useState<Marks>(() => marksFrom(rows));
  const [marks, setMarks] = useState<Marks>(() => readDraft(draftKey, baseline));
  const [restored, setRestored] = useState(() => rows.some((row) => !sameMark(marks[row.studentId], baseline[row.studentId])));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ at?: string; by?: string; result?: BulkResult }>({ at: sheet.markedAt, by: sheet.markedBy });
  const savingRef = useRef(false);
  const marksRef = useRef(marks);
  marksRef.current = marks;

  const changed = useMemo(() => {
    const ids = new Set<number>();
    for (const row of rows) {
      if (!sameMark(marks[row.studentId], baseline[row.studentId])) ids.add(row.studentId);
    }
    return ids;
  }, [rows, marks, baseline]);
  const hasChanges = changed.size > 0;
  const onServer = sheet.alreadyMarked || Boolean(saved.result);

  useEffect(() => {
    if (sheet.canMark) writeDraft(draftKey, marks, changed);
  }, [draftKey, marks, changed, sheet.canMark]);

  useEffect(() => {
    if (!hasChanges) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  // ---- Marking ----
  const [dialog, setDialog] = useState<number | null>(null);

  const update = useCallback((studentId: number, change: (mark: AttendanceMark) => AttendanceMark) => {
    setMarks((current) => {
      const next = change(current[studentId]);
      return next === current[studentId] ? current : { ...current, [studentId]: next };
    });
  }, []);

  // P or A. Choosing the button a student already has changes nothing, so a late student stays late.
  const chooseStatus = useCallback((studentId: number, status: Marking) => {
    update(studentId, (mark) => choose(mark, status));
  }, [update]);

  const openDetails = useCallback((studentId: number) => setDialog(studentId), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  // ---- Finding students ----
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>(readSort);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const query = useDeferredValue(search.trim().toLowerCase());

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: rows.length, PRESENT: 0, ABSENT: 0, DISCIPLINE: 0 };
    for (const row of rows) {
      const mark = marks[row.studentId];
      result[markingStatus(mark.status)] += 1;
      if (hasDiscipline(mark)) result.DISCIPLINE += 1;
    }
    return result;
  }, [rows, marks]);

  // Filtering and sorting use the marks at the moment the view is chosen, so rows never jump away
  // while they are being marked.
  const visible = useMemo(() => {
    const current = marksRef.current;
    let list = rows;
    if (filter === 'DISCIPLINE') list = list.filter((row) => hasDiscipline(current[row.studentId]));
    else if (filter !== 'ALL') list = list.filter((row) => markingStatus(current[row.studentId].status) === filter);
    if (query) {
      list = list.filter((row) => row.fullName.toLowerCase().includes(query) || row.admissionNumber.toLowerCase().includes(query));
    }
    if (sort === 'name') return list; // the server sends students by name
    const byName = (a: SheetRow, b: SheetRow) => a.fullName.localeCompare(b.fullName);
    return [...list].sort(sort === 'admission'
      ? (a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true })
      : (a, b) => SORT_RANK[current[a.studentId].status] - SORT_RANK[current[b.studentId].status] || byName(a, b));
  }, [rows, filter, query, sort]);

  const changeSort = (next: Sort) => {
    setSort(next);
    try {
      window.localStorage.setItem(SORT_KEY, next);
    } catch {
      // Only a preference.
    }
  };

  // ---- Saving ----
  const save = async () => {
    if (savingRef.current || !sheet.canMark || rows.length === 0) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const submitted = marks;
    try {
      const result = await attendanceApi.saveBulk({
        batchId: sheet.batch.id,
        date: sheet.date,
        scheduleId: sheet.schedule?.id,
        entries: rows.map((row) => {
          const mark = submitted[row.studentId];
          return { studentId: row.studentId, ...mark, remarks: mark.remarks?.trim() || undefined };
        }),
      });
      // Anything changed while the request was on its way stays marked as not saved.
      setBaseline(submitted);
      setRestored(false);
      setSaved({ at: new Date().toISOString(), by: taker, result });
      onSaved();
    } catch (failure) {
      setSaveError(errorMessage(failure, 'Attendance could not be saved'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const discard = () => {
    setMarks(baseline);
    setRestored(false);
  };

  let status: ReactNode;
  if (!sheet.canMark) {
    status = <span className="text-slate-500">You can view this register but not change it.</span>;
  } else if (saving) {
    status = <span className="text-slate-600">Saving attendance for {rows.length} students…</span>;
  } else if (saveError) {
    status = (
      <span className="flex items-start gap-1.5 text-rose-700" role="alert">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span><span className="font-semibold">Not saved:</span> {saveError}. Your marks are kept - try again.</span>
      </span>
    );
  } else if (hasChanges) {
    status = (
      <span className="text-amber-700">
        {changed.size} {changed.size === 1 ? 'change' : 'changes'} not saved
        {restored && (
          <> &middot; restored after a reload{' '}
            <button type="button" className="font-semibold text-slate-600 underline" onClick={discard}>Discard</button>
          </>
        )}
      </span>
    );
  } else if (saved.result) {
    const { notificationsQueued: queued, observationsRecorded: observed } = saved.result;
    status = (
      <span className="flex items-start gap-1.5 text-emerald-700">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <span>
          Saved for {saved.result.saved} students
          {queued > 0 && ` · ${queued} parent ${queued === 1 ? 'message' : 'messages'} queued`}
          {observed > 0 && ` · ${observed} discipline ${observed === 1 ? 'note' : 'notes'} added`}
        </span>
      </span>
    );
  } else if (onServer) {
    status = <span className="text-slate-500">Last saved {formatDateTime(saved.at)}{saved.by ? ` by ${saved.by}` : ''}</span>;
  } else {
    status = <span className="text-slate-500">Not taken yet - everyone starts as present</span>;
  }

  const canSave = sheet.canMark && rows.length > 0 && !saving && (hasChanges || !onServer);
  const upToDate = onServer && !hasChanges;
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.studentId, row])), [rows]);
  const dialogRow = dialog === null ? undefined : rowsById.get(dialog);
  const dialogMark = dialogRow ? marks[dialogRow.studentId] : undefined;

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 sm:px-4">
        <div className="flex items-center gap-2">
          {/* Until there is room for everything (xl), search is a button that swaps the chips for the field. */}
          <div role="group" aria-label="Show students"
            className={`no-scrollbar -mx-1 min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-0.5 sm:gap-1.5 ${searchOpen ? 'hidden xl:flex' : 'flex'}`}>
            {FILTERS.map((item) => {
              const active = filter === item.value;
              const count = counts[item.value];
              return (
                <button key={item.value} type="button" aria-pressed={active} title={item.label} aria-label={`${item.label} ${count}`}
                  onClick={() => setFilter(active ? 'ALL' : item.value)}
                  className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium transition sm:gap-1.5 sm:px-2.5 ${
                    active ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                  {item.dot && <span className={`hidden h-2 w-2 rounded-full sm:inline-block ${item.dot}`} />}
                  <span className={`max-sm:font-semibold md:hidden ${active ? '' : item.letter ?? ''}`}>{item.short}</span>
                  <span className="hidden md:inline">{item.label}</span>
                  <span className={`font-semibold tabular-nums ${active ? 'text-white' : count === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <label className={`relative min-w-0 flex-1 items-center xl:max-w-xs ${searchOpen ? 'flex' : 'hidden xl:flex'}`}>
            <Search size={15} className="pointer-events-none absolute left-2.5 text-slate-400" />
            <input ref={searchRef} type="search" className="input h-9 py-0 pl-8" placeholder="Search name or admission no."
              aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <button type="button" aria-label={searchOpen ? 'Close search' : 'Search students'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 xl:hidden"
            onClick={() => {
              if (searchOpen) {
                setSearch('');
                setSearchOpen(false);
                return;
              }
              // Render the field now so focusing it still counts as the tap (phones then open the keyboard).
              flushSync(() => setSearchOpen(true));
              searchRef.current?.focus();
            }}>
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <label title="Sort students"
            className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
            <ArrowUpDown size={15} className="text-slate-500" />
            <span className="hidden whitespace-nowrap md:inline">{SORTS.find((option) => option.value === sort)?.label}</span>
            <select value={sort} aria-label="Sort students" className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => changeSort(event.target.value as Sort)}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={saving}>
        {rows.length === 0 ? (
          <EmptyState title={`No active students in ${sheet.batch.name}`} />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <p className="text-sm text-slate-600">No students match</p>
            <button type="button" className="btn-secondary btn-sm" onClick={() => { setFilter('ALL'); setSearch(''); }}>Show everyone</button>
          </div>
        ) : (
          <>
            {/* Inside the scrolling list (sticky), so it is exactly as wide as the rows even when a scrollbar shows. */}
            <div aria-hidden="true"
              className={`sticky top-0 z-10 hidden items-center gap-x-3 border-b border-slate-200 bg-white py-1.5 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid ${DESKTOP_COLUMNS}`}>
              <span>Student</span>
              <span>Details</span>
              <span>Status</span>
              <span />
            </div>
            <ul>
              {visible.map((row) => (
                <StudentRow
                  key={row.studentId}
                  row={row}
                  mark={marks[row.studentId]}
                  changed={changed.has(row.studentId)}
                  readOnly={!sheet.canMark}
                  onStatus={chooseStatus}
                  onOpen={openDetails}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="truncate text-[11px] text-slate-400 sm:text-xs">Taking attendance as {taker}</p>
            <div className="text-xs sm:text-sm">{status}</div>
          </div>
          {sheet.canMark && (
            <button type="button" onClick={save} disabled={!canSave}
              className="btn-primary h-11 shrink-0 px-4 sm:h-10 sm:px-5">
              {saving ? <Loader2 size={16} className="animate-spin" /> : upToDate ? <Check size={16} /> : <Save size={16} />}
              {saving ? 'Saving…' : upToDate ? 'Saved' : saveError ? 'Try again' : onServer ? 'Save changes' : 'Save attendance'}
            </button>
          )}
        </div>
      </footer>

      {/* The details of the button the student already has: present (late, uniform, ID tag) or absent (reason). */}
      <Modal open={Boolean(dialogRow && dialogMark)} dismissible onClose={closeDialog}
        title={dialogRow && dialogMark ? `${dialogRow.fullName} · ${STATUS_STYLE[markingStatus(dialogMark.status)].label}` : ''}
        footer={<button type="button" className="btn-primary w-full sm:w-auto" onClick={closeDialog}>Done</button>}>
        {dialogRow && dialogMark && (
          <MarkEditor key={dialogRow.studentId} value={dialogMark} parentNotifiable={dialogRow.parentNotifiable}
            disabled={!sheet.canMark} onChange={(mark) => update(dialogRow.studentId, () => mark)} />
        )}
      </Modal>
    </>
  );
}

interface RowProps {
  row: SheetRow;
  mark: AttendanceMark;
  changed: boolean;
  readOnly: boolean;
  onStatus: (studentId: number, status: Marking) => void;
  onOpen: (studentId: number) => void;
}

/** A round P / A button on phones: filled in the status colour when selected, a quiet outline otherwise. */
function circleClass(selected: boolean, status: AttendanceStatus): string {
  return `flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
    selected ? `${STATUS_STYLE[status].selected} shadow-sm` : 'border-slate-300 bg-white text-slate-500'
  }`;
}

/** One student. Memoised: marking a student re-renders that row only, however long the register. */
const StudentRow = memo(function StudentRow({ row, mark, changed, readOnly, onStatus, onOpen }: RowProps) {
  const absent = mark.status === 'ABSENT';
  // P for present and late (late is part of present), A for absent (and marks saved as excused before).
  const chosen = markingStatus(mark.status);
  return (
    <li className={`attendance-row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-100 py-1 pl-4 pr-3 sm:pr-4 ${DESKTOP_COLUMNS}`}>
      {mark.status !== 'PRESENT' && (
        <span aria-hidden="true" className={`absolute inset-y-1.5 left-1 w-1 rounded-full ${STATUS_STYLE[mark.status].accent}`} />
      )}
      <button type="button" onClick={() => onOpen(row.studentId)} disabled={readOnly}
        className="flex min-w-0 items-center gap-3 rounded-lg py-1 text-left disabled:cursor-default">
        <StudentAvatar name={row.fullName} photoUrl={row.photoUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-900">{row.fullName}</span>
            {changed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" title="Not saved yet" />}
          </span>
          <span className="flex h-[18px] min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <span className="shrink-0">{row.admissionNumber}</span>
            {!row.parentNotifiable && <BellOff size={11} className="shrink-0 text-slate-400" aria-label="Parent not on WhatsApp" />}
            <MarkDetails mark={mark} compact showStatus={!absent} className="lg:hidden" />
          </span>
        </span>
      </button>

      {/* Always rendered, even when empty, so the status column stays in the same place on every row. */}
      <div className="hidden min-w-0 lg:block">
        <MarkDetails mark={mark} showStatus={!absent} />
      </div>

      {/* Phones: round P and A, one tap each. Late and the other details are set by tapping the
          student and show as a label under the name. */}
      <div role="radiogroup" aria-label={`Attendance of ${row.fullName}`} className="flex items-center gap-2 sm:hidden">
        <button type="button" role="radio" aria-checked={chosen === 'PRESENT'} aria-label="Present" disabled={readOnly}
          onClick={() => onStatus(row.studentId, 'PRESENT')} className={circleClass(chosen === 'PRESENT', 'PRESENT')}>
          P
        </button>
        <button type="button" role="radio" aria-checked={chosen === 'ABSENT'} aria-label="Absent" disabled={readOnly}
          onClick={() => onStatus(row.studentId, 'ABSENT')} className={circleClass(chosen === 'ABSENT', 'ABSENT')}>
          A
        </button>
      </div>

      {/* Tablets and desktops: Present or Absent, one tap each. */}
      <div role="radiogroup" aria-label={`Attendance of ${row.fullName}`}
        className="hidden items-center gap-0.5 justify-self-end rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex lg:justify-self-start">
        {MARKING_STATUSES.map((status) => {
          const selected = chosen === status;
          return (
            <button key={status} type="button" role="radio" aria-checked={selected} disabled={readOnly}
              onClick={() => onStatus(row.studentId, status)}
              className={`h-10 w-[4.75rem] rounded-md border text-sm font-semibold transition lg:h-8 ${
                selected ? STATUS_STYLE[status].selected : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
              }`}>
              {STATUS_STYLE[status].label}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => onOpen(row.studentId)} disabled={readOnly} title="Late time, discipline, reason and note"
        aria-label={`More for ${row.fullName}`}
        className="hidden h-8 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:flex">
        <Ellipsis size={18} />
      </button>
    </li>
  );
});
