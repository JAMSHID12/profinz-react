import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  Clock,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useBatches, useCourses, useMentors } from '../../hooks/lookups';
import { StudentAvatar } from '../../components/attendance';
import {
  BarList,
  DonutChart,
  LegendSwatch,
  Meter,
  PREVIOUS_COLOR,
  RateTrendChart,
  StackedColumns,
  STATUS_COLORS,
  attendanceTone,
  percentOf,
} from '../../components/charts';
import type { ColumnSeries, DonutSegment, RatePoint } from '../../components/charts';
import { StudentAttendanceModal } from '../../components/StudentAttendanceModal';
import type { StudentPeriod } from '../../components/StudentAttendanceModal';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Spinner, Tabs } from '../../components/ui';
import type { AdminAttendanceDashboard, AttendanceTrendPoint, RiskLevel, StudentRisk } from '../../types';
import { addDays, formatCount, formatDate, formatDay, formatShortDate, todayIso } from '../../utils/format';

/**
 * The administrator's home: attendance and discipline across every class. One filter card (period,
 * course, class, mentor and an optional comparison with the period before) scopes every tab; the
 * numbers change only when the filters are applied. Clicking a student opens their attendance.
 */

type TabKey = 'overview' | 'attendance' | 'discipline' | 'students';
type PeriodKey = '7' | '30' | '90' | 'MONTH' | 'LAST_MONTH' | 'CUSTOM';

interface Filters {
  period: PeriodKey;
  from: string;
  to: string;
  courseId: string;
  batchId: string;
  mentorId: string;
  compare: boolean;
}

const DEFAULT_FILTERS: Filters = { period: '30', from: '', to: '', courseId: '', batchId: '', mentorId: '', compare: false };

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'MONTH', label: 'This month' },
  { key: 'LAST_MONTH', label: 'Last month' },
  { key: 'CUSTOM', label: 'Custom dates' },
];

/** Below this attendance a student or a class needs attention (the server uses the same line). */
const AT_RISK_BELOW = 75;

/** Discipline kinds, in one fixed order and colour everywhere (validated as a set). */
const DISCIPLINE_SERIES: ColumnSeries[] = [
  { key: 'late', label: 'Late', color: '#f59e0b' },
  { key: 'noUniform', label: 'No uniform', color: '#7c3aed' },
  { key: 'noIdTag', label: 'No ID tag', color: '#0891b2' },
  { key: 'other', label: 'Other', color: '#db2777' },
];

const RISK_STYLE: Record<RiskLevel, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-rose-100 text-rose-700' },
  AT_RISK: { label: 'At risk', className: 'bg-amber-100 text-amber-800' },
  MONITOR: { label: 'Monitor', className: 'bg-sky-100 text-sky-700' },
  OK: { label: 'On track', className: 'bg-emerald-100 text-emerald-700' },
};

const WEEKDAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

/** The dates a period stands for. Custom dates fall back to the last 30 days until both are chosen. */
function rangeOf(filters: Filters): { from: string; to: string } {
  const today = todayIso();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (filters.period) {
    case '7':
      return { from: addDays(today, -6), to: today };
    case '90':
      return { from: addDays(today, -89), to: today };
    case 'MONTH':
      return { from: monthStart, to: today };
    case 'LAST_MONTH': {
      const end = addDays(monthStart, -1);
      return { from: `${end.slice(0, 8)}01`, to: end };
    }
    case 'CUSTOM':
      if (filters.from && filters.to) return { from: filters.from, to: filters.to };
      return { from: addDays(today, -29), to: today };
    default:
      return { from: addDays(today, -29), to: today };
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

function sameFilters(a: Filters, b: Filters): boolean {
  return (Object.keys(a) as (keyof Filters)[]).every((key) => a[key] === b[key]);
}

function studentPeriod(period: PeriodKey): StudentPeriod {
  return period === '7' || period === '90' ? period : '30';
}

function ratePoint(point: AttendanceTrendPoint, daily: boolean): RatePoint {
  return {
    label: daily ? formatShortDate(point.start) : point.label,
    title: daily ? formatDay(point.start) : `${point.label} · ${formatShortDate(point.start)} – ${formatShortDate(point.end)}`,
    present: point.present,
    late: point.late,
    excused: point.excused,
    absent: point.absent,
  };
}

// ---- Page --------------------------------------------------------------------------------------

export default function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [studentId, setStudentId] = useState<number | null>(null);
  const courses = useCourses();
  const batches = useBatches();
  const mentors = useMentors();

  const range = rangeOf(applied);
  const query = useQuery(
    () => dashboardApi.admin({
      from: range.from,
      to: range.to,
      courseId: applied.courseId || undefined,
      batchId: applied.batchId || undefined,
      mentorId: applied.mentorId || undefined,
      compare: applied.compare,
    }),
    [applied],
  );
  const data = query.data;

  const scope = [
    courses.find((course) => String(course.id) === applied.courseId)?.name,
    batches.find((batch) => String(batch.id) === applied.batchId)?.name,
    mentors.find((mentor) => String(mentor.id) === applied.mentorId)?.fullName,
  ].filter(Boolean).join(' · ') || 'All active classes';
  const flagged = data ? data.students.filter((student) => student.risk !== 'OK').length : null;

  return (
    <div>
      <PageHeader
        title="Attendance & discipline"
        subtitle={`${scope} · ${formatDate(data?.from ?? range.from)} – ${formatDate(data?.to ?? range.to)}`}
      />
      <Tabs<TabKey>
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'discipline', label: 'Discipline' },
          { key: 'students', label: flagged === null ? 'Students requiring attention' : `Students requiring attention (${flagged})` },
        ]}
        active={tab}
        onChange={setTab}
      />
      <FilterCard
        draft={draft}
        applied={applied}
        onChange={setDraft}
        onApply={() => setApplied(draft)}
        onReset={() => {
          setDraft(DEFAULT_FILTERS);
          setApplied(DEFAULT_FILTERS);
        }}
        courses={courses.filter((course) => course.status === 'ACTIVE').map((course) => ({ id: course.id, name: course.name }))}
        batches={batches.filter((batch) => batch.status === 'ACTIVE')}
        mentors={mentors.filter((mentor) => mentor.active).map((mentor) => ({ id: mentor.id, name: mentor.fullName }))}
        loading={query.loading}
      />

      {!data ? (
        query.error ? <ErrorState message={query.error} onRetry={query.reload} /> : <Spinner />
      ) : (
        <div className={`transition-opacity ${query.loading ? 'opacity-60' : ''}`} aria-busy={query.loading}>
          {query.error && (
            <div className="mb-4">
              <ErrorState message={query.error} onRetry={query.reload} />
            </div>
          )}
          {tab === 'overview' && <Overview data={data} onStudent={setStudentId} onTab={setTab} />}
          {tab === 'attendance' && <AttendanceTab data={data} onStudent={setStudentId} />}
          {tab === 'discipline' && <DisciplineTab data={data} onStudent={setStudentId} />}
          {tab === 'students' && <StudentsTab data={data} onStudent={setStudentId} />}
        </div>
      )}

      <StudentAttendanceModal key={studentId ?? 'closed'} studentId={studentId} initialPeriod={studentPeriod(applied.period)}
        onClose={() => setStudentId(null)} />
    </div>
  );
}

// ---- Filters -----------------------------------------------------------------------------------

function FilterCard({ draft, applied, onChange, onApply, onReset, courses, batches, mentors, loading }: {
  draft: Filters;
  applied: Filters;
  onChange: (filters: Filters) => void;
  onApply: () => void;
  onReset: () => void;
  courses: { id: number; name: string }[];
  batches: { id: number; name: string; course: { id: number }; mentor?: { id: number } }[];
  mentors: { id: number; name: string }[];
  loading: boolean;
}) {
  const set = (changes: Partial<Filters>) => onChange({ ...draft, ...changes });
  const batchOptions = batches.filter((batch) =>
    (!draft.courseId || String(batch.course.id) === draft.courseId)
    && (!draft.mentorId || String(batch.mentor?.id) === draft.mentorId));
  /** A class that no longer matches the course or mentor is cleared rather than silently ignored. */
  const withBatchCheck = (changes: Partial<Filters>) => {
    const next = { ...draft, ...changes };
    const batch = batches.find((item) => String(item.id) === next.batchId);
    const fits = batch
      && (!next.courseId || String(batch.course.id) === next.courseId)
      && (!next.mentorId || String(batch.mentor?.id) === next.mentorId);
    onChange(fits ? next : { ...next, batchId: '' });
  };

  const today = todayIso();
  const customError = draft.period !== 'CUSTOM' ? null
    : !draft.from || !draft.to ? 'Choose both dates'
      : draft.from > draft.to ? 'The start date is after the end date'
        : draft.to > today ? 'The end date is in the future'
          : daysBetween(draft.from, draft.to) > 366 ? 'Choose at most a year'
            : null;
  const pending = !sameFilters(draft, applied);
  const changed = !sameFilters(applied, DEFAULT_FILTERS) || pending;

  return (
    <Card className="mb-5 p-4">
      <form className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!customError) onApply();
        }}>
        <Field label="Time period">
          <select className="input" value={draft.period} onChange={(event) => set({ period: event.target.value as PeriodKey })}>
            {PERIODS.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
          </select>
        </Field>
        {draft.period === 'CUSTOM' && (
          <>
            <Field label="From">
              <input type="date" className="input" value={draft.from} max={draft.to || today}
                onChange={(event) => set({ from: event.target.value })} />
            </Field>
            <Field label="To">
              <input type="date" className="input" value={draft.to} min={draft.from || undefined} max={today}
                onChange={(event) => set({ to: event.target.value })} />
            </Field>
          </>
        )}
        <Field label="Course">
          <select className="input" value={draft.courseId} onChange={(event) => withBatchCheck({ courseId: event.target.value })}>
            <option value="">All courses</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </Field>
        <Field label="Class / batch">
          <select className="input" value={draft.batchId} onChange={(event) => set({ batchId: event.target.value })}>
            <option value="">All classes</option>
            {batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
          </select>
        </Field>
        <Field label="Mentor">
          <select className="input" value={draft.mentorId} onChange={(event) => withBatchCheck({ mentorId: event.target.value })}>
            <option value="">All mentors</option>
            {mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
          </select>
        </Field>
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 xl:w-auto">
          <label className="inline-flex cursor-pointer items-center gap-2 py-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={draft.compare}
              onChange={(event) => set({ compare: event.target.checked })} />
            Compare with the previous period
          </label>
          <div className="ml-auto flex items-center gap-2">
            {changed && (
              <button type="button" className="btn-ghost" onClick={onReset}>
                <RotateCcw size={14} /> Reset
              </button>
            )}
            <button type="submit" className="btn-primary relative" disabled={Boolean(customError) || loading}>
              <SlidersHorizontal size={16} /> Apply filters
              {pending && !customError && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" aria-label="Filters not applied yet" />
              )}
            </button>
          </div>
        </div>
      </form>
      {customError && <p className="mt-2 text-xs text-rose-700">{customError}</p>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-[10rem] flex-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// ---- Overview ----------------------------------------------------------------------------------

function Overview({ data, onStudent, onTab }: {
  data: AdminAttendanceDashboard;
  onStudent: (id: number) => void;
  onTab: (tab: TabKey) => void;
}) {
  return (
    <div className="space-y-5">
      <KpiRow data={data} />
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <TrendCard data={data} className="lg:col-span-2" />
        <TodayCard data={data} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        <ClassesCard data={data} limit={8} onMore={() => onTab('attendance')} className="md:col-span-2 xl:col-span-1" />
        <DisciplineTypesCard data={data} />
        <ReasonsCard data={data} />
      </div>
      <div className="grid gap-5 2xl:grid-cols-2 [&>*]:min-w-0">
        <AbsenteesCard data={data} limit={5} onStudent={onStudent} onMore={() => onTab('attendance')} />
        <AttentionCard data={data} limit={5} onStudent={onStudent} onMore={() => onTab('students')} />
      </div>
    </div>
  );
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_BADGE: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warn: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  bad: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

function Kpi({ label, value, badge, hint, icon, className = '' }: {
  label: string;
  value: ReactNode;
  badge?: { tone: Tone; text: string; icon?: ReactNode };
  hint: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col p-4 ${className}`}>
      <p className="flex min-w-0 items-start gap-1.5 text-xs font-medium leading-4 text-slate-500">
        <span className="shrink-0 text-slate-400" aria-hidden="true">{icon}</span>
        <span className="min-w-0">{label}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{value}</span>
        {badge && (
          <span className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_BADGE[badge.tone]}`}>
            {badge.icon}
            <span className="truncate">{badge.text}</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function KpiRow({ data }: { data: AdminAttendanceDashboard }) {
  const { totals, previousTotals, today, activeStudents } = data;
  const hasPeriod = totals.totalClasses > 0;
  const delta = hasPeriod && previousTotals
    ? Math.round((totals.attendancePercentage - previousTotals.attendancePercentage) * 10) / 10
    : null;
  const presentShare = today.marked === 0 ? null : (today.present * 100) / today.marked;
  const absentShare = today.marked === 0 ? 0 : (today.absent * 100) / today.marked;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5 [&>*]:min-w-0">
      <Kpi label="Overall attendance" value={hasPeriod ? `${totals.attendancePercentage}%` : '–'}
        badge={delta === null ? undefined : {
          tone: delta >= 0 ? 'good' : 'bad',
          icon: delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />,
          text: `${delta > 0 ? '+' : ''}${delta} pts`,
        }}
        hint={delta !== null ? `vs the ${daysBetween(data.from, data.to)} days before`
          : hasPeriod ? 'No earlier attendance to compare' : 'No attendance in this period'}
        icon={<CalendarCheck size={14} />} />
      <Kpi label="Present today" value={formatCount(today.present)}
        badge={presentShare === null ? undefined
          : presentShare >= 90 ? { tone: 'good', text: 'Healthy' }
            : presentShare >= AT_RISK_BELOW ? { tone: 'warn', text: 'Watch' } : { tone: 'bad', text: 'Low' }}
        hint={today.marked === 0 ? `Not taken yet · ${formatCount(activeStudents)} students`
          : `of ${formatCount(activeStudents)} students${today.notMarked > 0 ? ` · ${formatCount(today.notMarked)} not marked` : ''}`}
        icon={<Users size={14} />} />
      <Kpi label="Absent today" value={formatCount(today.absent)}
        badge={today.marked === 0 ? undefined
          : { tone: absentShare >= 10 ? 'bad' : absentShare >= 5 ? 'warn' : 'neutral', text: percentOf(today.absent, today.marked) }}
        hint={`${formatCount(today.absentWithoutReason)} without an informed reason`}
        icon={<UserX size={14} />} />
      <Kpi label="Late arrivals" value={formatCount(today.late)}
        badge={today.late > 0 ? { tone: 'warn', text: 'Needs review' } : undefined}
        hint={`${percentOf(today.late, today.present)} of students present`}
        icon={<Clock size={14} />} />
      <Kpi className="col-span-2 lg:col-span-1" label="Students at risk" value={formatCount(data.studentsAtRisk)}
        badge={data.studentsAtRisk > 0 ? { tone: 'bad', text: 'Action' } : { tone: 'good', text: 'None' }}
        hint={`Attendance below ${AT_RISK_BELOW}% in this period`}
        icon={<AlertTriangle size={14} />} />
    </div>
  );
}

// ---- Charts ------------------------------------------------------------------------------------

/** Days (or weeks) with attendance taken; Sundays and holidays have none and are left out. */
function taught(points: AttendanceTrendPoint[]): AttendanceTrendPoint[] {
  return points.filter((point) => point.present + point.late + point.absent + point.excused > 0);
}

/**
 * The trend runs over school days only, so days without classes do not break the line. With a
 * comparison, the previous period's school days line up with this period's, first with first.
 */
function TrendCard({ data, height = 220, className = '' }: { data: AdminAttendanceDashboard; height?: number; className?: string }) {
  const [table, setTable] = useState(false);
  const daily = data.granularity === 'DAY';
  const rows = useMemo(() => taught(data.trend), [data.trend]);
  const points = useMemo(() => rows.map((point) => ratePoint(point, daily)), [rows, daily]);
  const previous = useMemo(() => {
    const earlier = taught(data.previousTrend);
    return earlier.length > 0 ? earlier.map((point) => ratePoint(point, daily)) : undefined;
  }, [data.previousTrend, daily]);

  return (
    <Card className={className}>
      <CardHeader title="Attendance trend"
        subtitle={`Students present (late included) per ${daily ? 'day' : 'week'}`}
        actions={(
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-0.5 w-4 rounded-full bg-brand-600" aria-hidden="true" /> This period
            </span>
            {previous && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-0.5 w-4 rounded-full" style={{ background: PREVIOUS_COLOR }} aria-hidden="true" /> Previous period
              </span>
            )}
            <button type="button" className="btn-ghost btn-sm" aria-pressed={table} onClick={() => setTable((value) => !value)}>
              <Table2 size={14} /> {table ? 'Chart' : 'Table'}
            </button>
          </>
        )} />
      <div className="p-4">
        {data.totals.totalClasses === 0 ? (
          <EmptyState title="No attendance in this period" />
        ) : table ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="table">
              <thead className="sticky top-0">
                <tr>
                  <th>{daily ? 'Day' : 'Week'}</th>
                  <th className="text-right">Attended</th>
                  <th className="text-right">Present</th>
                  <th className="text-right">Late</th>
                  <th className="text-right">Absent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((point, index) => {
                  const total = point.present + point.late + point.absent + point.excused;
                  return (
                    <tr key={point.start}>
                      <td className="whitespace-nowrap">{points[index].title}</td>
                      <td className="text-right font-semibold tabular-nums">{percentOf(point.present + point.late, total)}</td>
                      <td className="text-right tabular-nums">{formatCount(point.present)}</td>
                      <td className="text-right tabular-nums">{formatCount(point.late)}</td>
                      <td className="text-right tabular-nums">{formatCount(point.absent + point.excused)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <RateTrendChart points={points} previous={previous} height={height} />
        )}
      </div>
    </Card>
  );
}

function TodayCard({ data }: { data: AdminAttendanceDashboard }) {
  const { today } = data;
  const segments: DonutSegment[] = [
    { key: 'present', label: 'Present on time', value: today.present - today.late, color: STATUS_COLORS.PRESENT },
    { key: 'late', label: 'Present, late', value: today.late, color: STATUS_COLORS.LATE },
    { key: 'absent', label: 'Absent', value: today.absent, color: STATUS_COLORS.ABSENT },
  ];
  if (today.notMarked > 0) segments.push({ key: 'none', label: 'Not marked', value: today.notMarked, color: '#cbd5e1' });

  return (
    <Card>
      <CardHeader title="Present vs absent today" subtitle={formatDay(data.asOf)} />
      <div className="p-4">
        {today.marked === 0 ? (
          <EmptyState title="No attendance taken yet today" description={`${formatCount(data.activeStudents)} students in these classes`} />
        ) : (
          <DonutChart segments={segments} centerValue={formatCount(data.activeStudents)} centerLabel="students"
            size={156} thickness={18} layout="column" />
        )}
      </div>
    </Card>
  );
}

function ClassesCard({ data, limit, onMore, className = '' }: {
  data: AdminAttendanceDashboard;
  limit: number;
  onMore: () => void;
  className?: string;
}) {
  const rows = data.classes.slice(0, limit);
  return (
    <Card className={className}>
      <CardHeader title="Attendance by class" subtitle={`Lowest first · the line marks ${AT_RISK_BELOW}%`}
        actions={data.classes.length > limit ? <MoreButton onClick={onMore}>All {data.classes.length}</MoreButton> : undefined} />
      <div className="p-3">
        {rows.length === 0 ? (
          <EmptyState title="No attendance in this period" />
        ) : (
          <BarList max={100} threshold={AT_RISK_BELOW} labelWidth="8.5rem"
            rows={rows.map((row) => ({
              key: row.batch.id,
              label: row.batch.name,
              sublabel: row.course.name,
              value: row.summary.attendancePercentage,
              display: `${row.summary.attendancePercentage}%`,
            }))} />
        )}
      </div>
    </Card>
  );
}

function DisciplineTypesCard({ data }: { data: AdminAttendanceDashboard }) {
  const { discipline } = data;
  const total = discipline.late + discipline.noUniform + discipline.noIdTag + discipline.other;
  return (
    <Card>
      <CardHeader title="Discipline issues by type"
        subtitle={`${formatCount(total)} in this period · ${formatCount(discipline.open)} ${discipline.open === 1 ? 'record' : 'records'} open`} />
      <div className="p-3">
        {total === 0 ? (
          <EmptyState title="No discipline issues in this period" />
        ) : (
          <BarList labelWidth="5.5rem" valueWidth="4rem"
            rows={DISCIPLINE_SERIES.map((series) => {
              const value = discipline[series.key as 'late' | 'noUniform' | 'noIdTag' | 'other'];
              return { key: series.key, label: series.label, value, display: formatCount(value) };
            })} />
        )}
      </div>
    </Card>
  );
}

function ReasonsCard({ data }: { data: AdminAttendanceDashboard }) {
  const total = data.absenceReasons.reduce((sum, reason) => sum + reason.count, 0);
  return (
    <Card>
      <CardHeader title="Absence reasons" subtitle={`${formatCount(total)} ${total === 1 ? 'absence' : 'absences'} in this period`} />
      <div className="p-3">
        {total === 0 ? (
          <EmptyState title="No absences in this period" />
        ) : (
          <BarList labelWidth="6.5rem" valueWidth="3.5rem"
            rows={data.absenceReasons.map((reason) => ({
              key: reason.key,
              label: reason.label,
              sublabel: percentOf(reason.count, total),
              value: reason.count,
              display: formatCount(reason.count),
            }))} />
        )}
      </div>
    </Card>
  );
}

function WeekdayCard({ data }: { data: AdminAttendanceDashboard }) {
  const days = data.weekdays.filter((day) => day.marks > 0);
  return (
    <Card>
      <CardHeader title="Attendance by weekday" subtitle={`Across the period · the line marks ${AT_RISK_BELOW}%`} />
      <div className="p-3">
        {days.length === 0 ? (
          <EmptyState title="No attendance in this period" />
        ) : (
          <BarList max={100} threshold={AT_RISK_BELOW} labelWidth="6.5rem"
            rows={days.map((day) => {
              const rate = Math.round((day.attended * 1000) / day.marks) / 10;
              return { key: day.day, label: WEEKDAY_LABELS[day.day] ?? day.day, sublabel: `${formatCount(day.marks)} marks`, value: rate, display: `${rate}%` };
            })} />
        )}
      </div>
    </Card>
  );
}

// ---- Tabs --------------------------------------------------------------------------------------

function AttendanceTab({ data, onStudent }: { data: AdminAttendanceDashboard; onStudent: (id: number) => void }) {
  const { totals } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <MiniStat label="Attendance" value={totals.totalClasses === 0 ? '–' : `${totals.attendancePercentage}%`} hint="Present or late" />
        <MiniStat label="Marks taken" value={formatCount(totals.totalClasses)} hint={`${formatCount(data.activeStudents)} active students`} />
        <MiniStat label="Late marks" value={formatCount(totals.late)} hint={`${percentOf(totals.late, totals.present + totals.late)} of present marks`}
          color={STATUS_COLORS.LATE} />
        <MiniStat label="Absences" value={formatCount(totals.absent + totals.excused)} hint={`${percentOf(totals.absent + totals.excused, totals.totalClasses)} of marks`}
          color={STATUS_COLORS.ABSENT} />
      </div>
      <TrendCard data={data} height={260} />
      <ClassTable data={data} />
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <WeekdayCard data={data} />
        <ReasonsCard data={data} />
      </div>
      <AbsenteesCard data={data} limit={15} onStudent={onStudent} />
    </div>
  );
}

function DisciplineTab({ data, onStudent }: { data: AdminAttendanceDashboard; onStudent: (id: number) => void }) {
  const { discipline } = data;
  const columns = data.disciplineWeeks.map((week) => ({
    key: week.start,
    label: week.label,
    title: `${week.label} · ${formatShortDate(week.start)} – ${formatShortDate(week.end)}`,
    values: { late: week.late, noUniform: week.noUniform, noIdTag: week.noIdTag, other: week.other },
  }));
  const any = columns.some((column) => Object.values(column.values).some((value) => value > 0));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 [&>*]:min-w-0">
        {DISCIPLINE_SERIES.map((series) => (
          <MiniStat key={series.key} label={series.label} color={series.color}
            value={formatCount(discipline[series.key as 'late' | 'noUniform' | 'noIdTag' | 'other'])} />
        ))}
        <MiniStat label="Records open" value={formatCount(discipline.open)} hint="Not resolved yet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title="Issues by week" subtitle="Late arrivals and discipline records"
            actions={(
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                {DISCIPLINE_SERIES.map((series) => (
                  <span key={series.key} className="inline-flex items-center gap-1.5">
                    <LegendSwatch color={series.color} /> {series.label}
                  </span>
                ))}
              </div>
            )} />
          <div className="p-4">
            {any ? <StackedColumns columns={columns} series={DISCIPLINE_SERIES} height={200} />
              : <EmptyState title="No discipline issues in this period" />}
          </div>
        </Card>
        <DisciplineTypesCard data={data} />
      </div>
      <IssuesCard data={data} onStudent={onStudent} />
    </div>
  );
}

function StudentsTab({ data, onStudent }: { data: AdminAttendanceDashboard; onStudent: (id: number) => void }) {
  const [risk, setRisk] = useState<RiskLevel | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const flagged = data.students.filter((student) => student.risk !== 'OK');
  const term = search.trim().toLowerCase();
  const rows = flagged.filter((student) => (risk === 'ALL' || student.risk === risk)
    && (!term || student.fullName.toLowerCase().includes(term) || student.admissionNumber.toLowerCase().includes(term)
      || (student.batch?.name.toLowerCase().includes(term) ?? false)));
  const options: { key: RiskLevel | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: flagged.length },
    ...(['CRITICAL', 'AT_RISK', 'MONITOR'] as RiskLevel[]).map((level) => ({
      key: level,
      label: RISK_STYLE[level].label,
      count: flagged.filter((student) => student.risk === level).length,
    })),
  ];

  return (
    <Card>
      <CardHeader title="Students requiring attention"
        subtitle={`${formatCount(flagged.length)} of ${formatCount(data.students.length)} students with attendance in this period`} />
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label="Status">
          {options.map((option) => (
            <button key={option.key} type="button" role="radio" aria-checked={risk === option.key} onClick={() => setRisk(option.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                risk === option.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {option.label} <span className="tabular-nums opacity-70">{option.count}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Search students</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Name, admission no. or class" value={search}
            onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={flagged.length === 0 ? 'Every student is on track' : 'No students match'} />
      ) : (
        <StudentTable rows={rows} onStudent={onStudent} showClass showAbsences />
      )}
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <strong className="font-semibold text-slate-700">Critical</strong>: attendance under 65%, or under {AT_RISK_BELOW}% with 3 or more
        issues. <strong className="font-semibold text-slate-700">At risk</strong>: under {AT_RISK_BELOW}%, 4 or more issues, or late for a
        quarter of the classes. <strong className="font-semibold text-slate-700">Monitor</strong>: under 85%, 2 or more issues, or late for
        one class in eight. Issues are uniform, ID tag and other discipline records.
      </p>
    </Card>
  );
}

// ---- Lists -------------------------------------------------------------------------------------

function AbsenteesCard({ data, limit, onStudent, onMore }: {
  data: AdminAttendanceDashboard;
  limit: number;
  onStudent: (id: number) => void;
  onMore?: () => void;
}) {
  const absentees = data.students
    .filter((student) => student.absences > 0)
    .sort((a, b) => b.absences - a.absences
      || a.summary.attendancePercentage - b.summary.attendancePercentage
      || a.fullName.localeCompare(b.fullName));
  return (
    <Card>
      <CardHeader title="Top frequent absentees" subtitle="Most absences in the period"
        actions={onMore && absentees.length > limit ? <MoreButton onClick={onMore}>Show more</MoreButton> : undefined} />
      {absentees.length === 0 ? (
        <EmptyState title="No absences in this period" />
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[30rem]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th className="text-right">Absences</th>
                <th className="w-40">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {absentees.slice(0, limit).map((student) => (
                <tr key={student.studentId} className="cursor-pointer" onClick={() => onStudent(student.studentId)}>
                  <td><StudentCell student={student} onOpen={onStudent} /></td>
                  <td className="whitespace-nowrap text-slate-600">{student.batch?.name ?? '–'}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-900">{formatCount(student.absences)}</td>
                  <td><AttendanceCell value={student.summary.attendancePercentage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AttentionCard({ data, limit, onStudent, onMore }: {
  data: AdminAttendanceDashboard;
  limit: number;
  onStudent: (id: number) => void;
  onMore: () => void;
}) {
  const flagged = data.students.filter((student) => student.risk !== 'OK');
  return (
    <Card>
      <CardHeader title="Students requiring attention" subtitle="Most serious first"
        actions={flagged.length > limit ? <MoreButton onClick={onMore}>All {flagged.length}</MoreButton> : undefined} />
      {flagged.length === 0 ? (
        <EmptyState title="Every student is on track" />
      ) : (
        <StudentTable rows={flagged.slice(0, limit)} onStudent={onStudent} />
      )}
    </Card>
  );
}

function IssuesCard({ data, onStudent }: { data: AdminAttendanceDashboard; onStudent: (id: number) => void }) {
  const rows = data.students
    .filter((student) => student.issues + student.late > 0)
    .sort((a, b) => b.issues + b.late - (a.issues + a.late) || b.issues - a.issues || a.fullName.localeCompare(b.fullName))
    .slice(0, 20);
  return (
    <Card>
      <CardHeader title="Students with the most issues" subtitle="Late arrivals and discipline records in the period" />
      {rows.length === 0 ? (
        <EmptyState title="No discipline issues in this period" />
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[40rem]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th className="text-right">Late</th>
                <th className="text-right">No uniform</th>
                <th className="text-right">No ID tag</th>
                <th className="text-right">Other</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr key={student.studentId} className="cursor-pointer" onClick={() => onStudent(student.studentId)}>
                  <td><StudentCell student={student} onOpen={onStudent} /></td>
                  <td className="whitespace-nowrap text-slate-600">{student.batch?.name ?? '–'}</td>
                  <td className="text-right tabular-nums">{student.late}</td>
                  <td className="text-right tabular-nums">{student.noUniform}</td>
                  <td className="text-right tabular-nums">{student.noIdTag}</td>
                  <td className="text-right tabular-nums">{student.otherIssues}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-900">{student.late + student.issues}</td>
                  <td><RiskBadge risk={student.risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ClassTable({ data }: { data: AdminAttendanceDashboard }) {
  return (
    <Card>
      <CardHeader title="Attendance by class" subtitle="Lowest attendance first" />
      {data.classes.length === 0 ? (
        <EmptyState title="No attendance in this period" />
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[44rem]">
            <thead>
              <tr>
                <th>Class</th>
                <th>Mentor</th>
                <th className="text-right">Students</th>
                <th className="text-right">Present</th>
                <th className="text-right">Late</th>
                <th className="text-right">Absent</th>
                <th className="w-40">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((row) => (
                <tr key={row.batch.id}>
                  <td>
                    <p className="font-medium text-slate-800">{row.batch.name}</p>
                    <p className="text-xs text-slate-500">{row.course.name}</p>
                  </td>
                  <td className="whitespace-nowrap text-slate-600">{row.mentor?.name ?? '–'}</td>
                  <td className="text-right tabular-nums">{formatCount(row.students)}</td>
                  <td className="text-right tabular-nums">{formatCount(row.summary.present)}</td>
                  <td className="text-right tabular-nums">{formatCount(row.summary.late)}</td>
                  <td className="text-right tabular-nums">{formatCount(row.summary.absent + row.summary.excused)}</td>
                  <td><AttendanceCell value={row.summary.attendancePercentage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StudentTable({ rows, onStudent, showClass = false, showAbsences = false }: {
  rows: StudentRisk[];
  onStudent: (id: number) => void;
  showClass?: boolean;
  showAbsences?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table min-w-[34rem]">
        <thead>
          <tr>
            <th>Student</th>
            {showClass && <th>Class</th>}
            <th className="w-36">Attendance</th>
            {showAbsences && <th className="text-right">Absences</th>}
            <th className="text-right">Late</th>
            <th className="text-right">Issues</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => (
            <tr key={student.studentId} className="cursor-pointer" onClick={() => onStudent(student.studentId)}>
              <td><StudentCell student={student} onOpen={onStudent} showClass={!showClass} /></td>
              {showClass && <td className="whitespace-nowrap text-slate-600">{student.batch?.name ?? '–'}</td>}
              <td><AttendanceCell value={student.summary.attendancePercentage} /></td>
              {showAbsences && <td className="text-right tabular-nums">{student.absences}</td>}
              <td className="text-right tabular-nums">{student.late}</td>
              <td className="text-right tabular-nums" title={`No uniform ${student.noUniform}, no ID tag ${student.noIdTag}, other ${student.otherIssues}`}>
                {student.issues}
              </td>
              <td><RiskBadge risk={student.risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Small parts -------------------------------------------------------------------------------

function StudentCell({ student, onOpen, showClass = false }: { student: StudentRisk; onOpen: (id: number) => void; showClass?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size={32} />
      <div className="min-w-0">
        <button type="button" className="block max-w-full truncate text-left font-medium text-slate-800 hover:text-brand-700 focus:outline-none focus-visible:underline"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(student.studentId);
          }}>
          {student.fullName}
        </button>
        <p className="truncate text-xs text-slate-500">
          {student.admissionNumber}{showClass && student.batch ? ` · ${student.batch.name}` : ''}
        </p>
      </div>
    </div>
  );
}

function AttendanceCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Meter value={value} className="w-full min-w-[3rem] flex-1" />
      <span className={`w-12 text-right text-sm font-semibold tabular-nums ${attendanceTone(value).text}`}>{value}%</span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const style = RISK_STYLE[risk];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}

function MiniStat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {color && <LegendSwatch color={color} />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function MoreButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
      {children}
    </button>
  );
}
