import { useMemo, useState } from 'react';
import { dashboardApi } from '../api/endpoints';
import { useQuery } from '../hooks/useQuery';
import type { AttendanceSummary, StudentAttendanceDetail } from '../types';
import { addDays, formatDay, todayIso } from '../utils/format';
import { MarkDetails } from './attendance';
import { DonutChart, STACK_ORDER, STATUS_COLORS, STATUS_LABELS, StatusLegend, statusSegments } from './charts';
import { Badge, EmptyState, ErrorState, Modal, Spinner } from './ui';

export type StudentPeriod = '7' | '30' | '90';

const PERIODS: { key: StudentPeriod; label: string; days: number }[] = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
];

function periodRange(key: StudentPeriod): { from: string; to: string } {
  const to = todayIso();
  const days = PERIODS.find((period) => period.key === key)?.days ?? 30;
  return { from: addDays(to, -(days - 1)), to };
}

function percent(summary: AttendanceSummary): string {
  return summary.totalClasses === 0 ? '–' : `${summary.attendancePercentage}%`;
}

/** A student's attendance: the status split, a calendar of the period and every absence or late mark. */
export function StudentAttendanceModal({ studentId, initialPeriod = '30', onClose }: {
  studentId: number | null;
  initialPeriod?: StudentPeriod;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<StudentPeriod>(initialPeriod);
  const range = periodRange(period);
  const query = useQuery(() => dashboardApi.studentAttendance(studentId!, range), [studentId, period], studentId !== null);
  const data = query.data && query.data.studentId === studentId ? query.data : null;

  return (
    <Modal open={studentId !== null} title={data?.fullName ?? 'Attendance'} onClose={onClose} wide dismissible>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data && (
          <p className="mr-auto text-sm text-slate-500">
            {data.admissionNumber}{data.batch ? ` · ${data.batch.name}` : ''}
          </p>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label="Period">
          {PERIODS.map((option) => (
            <button key={option.key} type="button" role="radio" aria-checked={period === option.key}
              onClick={() => setPeriod(option.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                period === option.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {!data ? (
        query.error ? <ErrorState message={query.error} onRetry={query.reload} /> : <Spinner />
      ) : (
        <div className={`space-y-5 transition-opacity ${query.loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Status split</p>
              {data.summary.totalClasses === 0 ? (
                <EmptyState title="No attendance in this period" />
              ) : (
                <DonutChart segments={statusSegments(data.summary).filter((segment) => segment.key !== 'EXCUSED' || segment.value > 0)}
                  centerValue={percent(data.summary)}
                  centerLabel="attended" size={148} thickness={18} />
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Day by day</p>
              <AttendanceCalendar detail={data} />
            </div>
          </div>
          <Exceptions detail={data} />
        </div>
      )}
    </Modal>
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Weeks as rows, Monday first; each day wears the colour of its most serious mark. */
function AttendanceCalendar({ detail }: { detail: StudentAttendanceDetail }) {
  const [hover, setHover] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(detail.days.map((day) => [day.date, day])), [detail.days]);
  const cells = useMemo(() => {
    const first = new Date(`${detail.from}T12:00:00Z`);
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const start = addDays(detail.from, -mondayOffset);
    const list: string[] = [];
    for (let day = start; day <= detail.to || list.length % 7 !== 0; day = addDays(day, 1)) list.push(day);
    return list;
  }, [detail.from, detail.to]);
  const hovered = hover ? byDate.get(hover) : undefined;

  return (
    <div>
      <div className="grid grid-cols-7 gap-[3px] text-center text-[10px] font-medium text-slate-400">
        {WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}
        {cells.map((date) => {
          const inRange = date >= detail.from && date <= detail.to;
          const day = byDate.get(date);
          const label = `${formatDay(date)}: ${day ? `${STATUS_LABELS[day.status]}${day.marks > 1 ? ` (${day.marks} marks)` : ''}` : 'no attendance'}`;
          return inRange ? (
            <span key={date} tabIndex={0} role="img" aria-label={label}
              onPointerEnter={() => setHover(date)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(date)} onBlur={() => setHover(null)}
              className={`mx-auto aspect-square w-full max-w-[2rem] rounded-[4px] outline-none transition focus-visible:ring-2 focus-visible:ring-slate-400 ${
                hover === date ? 'ring-2 ring-slate-400' : ''
              } ${day ? '' : 'bg-slate-100'}`}
              style={day ? { background: STATUS_COLORS[day.status] } : undefined} />
          ) : <span key={date} aria-hidden="true" />;
        })}
      </div>
      <p className="mt-2 h-4 text-xs text-slate-600" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold text-slate-900">{formatDay(hover)}</span>
            {' · '}
            {hovered ? `${STATUS_LABELS[hovered.status]}${hovered.marks > 1 ? ` (worst of ${hovered.marks} marks)` : ''}` : 'No attendance taken'}
          </>
        ) : 'Point at a day to see it'}
      </p>
      {/* Excused is no longer marked; it only appears for students who still have such marks. */}
      <StatusLegend className="mt-2" statuses={STACK_ORDER.filter((status) => status !== 'EXCUSED' || detail.summary.excused > 0)} />
    </div>
  );
}

function Exceptions({ detail }: { detail: StudentAttendanceDetail }) {
  const exceptions = detail.records.filter((record) => record.status !== 'PRESENT');
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-800">
        Absences and late arrivals <span className="font-normal text-slate-500">&middot; {exceptions.length}</span>
      </p>
      {exceptions.length === 0 ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Present at every class in this period.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {exceptions.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 text-slate-700">{formatDay(record.date)}</span>
              <Badge value={record.status} />
              <span className="text-xs text-slate-500">{record.subject?.name ?? 'Whole day'}</span>
              <MarkDetails mark={record} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
