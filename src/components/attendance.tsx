import { memo, useState, useEffect } from 'react';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import type { ReactNode } from 'react';
import { BellOff, Check, Clock, IdCard, Shirt, StickyNote } from 'lucide-react';
import type { AbsenceReason, AttendanceMark, AttendanceStatus } from '../types';
import { titleCase } from '../utils/format';

/** Every status the server knows, for filters and saved marks. Teachers choose from MARKING_STATUSES. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'HOLIDAY'];

export const STATUS_STYLE: Record<AttendanceStatus, { label: string; selected: string; accent: string; chip: string }> = {
  PRESENT: { label: 'Present', selected: 'border-emerald-600 bg-emerald-600 text-white', accent: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  ABSENT: { label: 'Absent', selected: 'border-rose-600 bg-rose-600 text-white', accent: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
  LATE: { label: 'Late', selected: 'border-amber-500 bg-amber-500 text-white', accent: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800' },
  HOLIDAY: { label: 'Holiday', selected: 'border-slate-500 bg-slate-500 text-white', accent: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
  EXCUSED: { label: 'Excused', selected: 'border-sky-600 bg-sky-600 text-white', accent: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
};

export const LATE_MINUTES = [10, 15, 30, 60, 120];
export const ABSENCE_REASONS: AbsenceReason[] = ['INFORMED', 'NOT_INFORMED'];
export const MAX_LATE_MINUTES = 600;

export function isAway(status: AttendanceStatus): boolean {
  return status === 'ABSENT' || status === 'EXCUSED';
}

/**
 * Changes the status and drops details that no longer apply - the same rules the server keeps:
 * minutes only when late, a reason only when away, and nothing observed about an absent student.
 */
export function withStatus(mark: AttendanceMark, status: AttendanceStatus): AttendanceMark {
  const away = isAway(status);
  return {
    ...mark,
    status,
    lateMinutes: status === 'LATE' ? mark.lateMinutes : undefined,
    absenceReason: away ? (mark.absenceReason ?? 'NOT_INFORMED') : undefined,
    noUniform: !away && mark.noUniform,
    noIdTag: !away && mark.noIdTag,
  };
}

/**
 * What a teacher chooses between: present or absent. Late is recorded as part of present (in the
 * student's details) and saved as the LATE status, so parents are still told and reports still
 * count it. Excused is no longer offered; marks saved as excused earlier count as absent here.
 */
export const MARKING_STATUSES: ('PRESENT' | 'ABSENT')[] = ['PRESENT', 'ABSENT'];

/** The button a saved status belongs to: P for present and late, A for absent and excused. */
export function markingStatus(status: AttendanceStatus): 'PRESENT' | 'ABSENT' {
  return isAway(status) ? 'ABSENT' : 'PRESENT';
}

/** Choosing P or A: keeps the details when the button does not change (a late student stays late). */
export function choose(mark: AttendanceMark, status: 'PRESENT' | 'ABSENT'): AttendanceMark {
  return markingStatus(mark.status) === status ? mark : withStatus(mark, status);
}

/** Late on or off for a present student; off also clears the minutes. */
export function withLate(mark: AttendanceMark, late: boolean): AttendanceMark {
  return withStatus(mark, late ? 'LATE' : 'PRESENT');
}

export function formatLate(minutes?: number): string {
  if (!minutes) return 'Late';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const label = `${hours} hr${hours === 1 ? '' : 's'}`;
  return rest === 0 ? label : `${label} ${rest} min`;
}

const AVATAR_TONES = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];

/** The student's photo, or their initials when there is none (or it fails to load). */
export const StudentAvatar = memo(function StudentAvatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);
  const imageUrl = usePhotoUrl(photoUrl);
  const style = { width: size, height: size };
  if (imageUrl && !failed) {
    return (
      <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
        className="shrink-0 rounded-full bg-slate-100 object-cover" style={style} />
    );
  }
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0]?.charAt(0) ?? '') + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '');
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return (
    <span aria-hidden="true" style={style}
      className={`flex shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold uppercase ${AVATAR_TONES[hash % AVATAR_TONES.length]}`}>
      {initials}
    </span>
  );
});

function Pill({ tone, icon, children, title }: { tone: string; icon?: ReactNode; children?: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-medium ${tone}`}>
      {icon}
      {children}
    </span>
  );
}

/**
 * What was recorded besides "present": late minutes, absence reason, observations and the note.
 * `showStatus` adds the status itself (for places without a status control next to it);
 * `compact` shows observations and the note as icons only, for narrow rows.
 */
export function MarkDetails({
  mark,
  showStatus = false,
  compact = false,
  className = '',
}: {
  mark: AttendanceMark;
  showStatus?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const style = STATUS_STYLE[mark.status];
  const items: ReactNode[] = [];
  if (mark.status === 'LATE' && (showStatus || mark.lateMinutes)) {
    items.push(<Pill key="late" tone={style.chip}>{showStatus ? 'Late' : ''}{showStatus && mark.lateMinutes ? ' · ' : ''}{mark.lateMinutes ? formatLate(mark.lateMinutes) : ''}</Pill>);
  } else if (showStatus && mark.status !== 'PRESENT') {
    items.push(<Pill key="status" tone={style.chip}>{style.label}</Pill>);
  }
  if (mark.absenceReason) {
    items.push(<Pill key="reason" tone="bg-slate-100 text-slate-700">{titleCase(mark.absenceReason)}</Pill>);
  }
  if (mark.noUniform) {
    items.push(<Pill key="uniform" tone="bg-violet-50 text-violet-700" icon={<Shirt size={11} />} title="No uniform">{compact ? null : 'No uniform'}</Pill>);
  }
  if (mark.noIdTag) {
    items.push(<Pill key="id" tone="bg-violet-50 text-violet-700" icon={<IdCard size={11} />} title="No ID tag">{compact ? null : 'No ID tag'}</Pill>);
  }
  if (mark.remarks) {
    items.push(compact ? (
      <StickyNote key="note" size={12} className="shrink-0 text-slate-400" aria-label={`Note: ${mark.remarks}`} />
    ) : (
      <span key="note" className="flex min-w-0 items-center gap-1 text-xs text-slate-500" title={mark.remarks}>
        <StickyNote size={12} className="shrink-0 text-slate-400" />
        <span className="truncate">{mark.remarks}</span>
      </span>
    ));
  }
  if (items.length === 0) return null;
  return <span className={`flex min-w-0 items-center gap-1 overflow-hidden ${className}`}>{items}</span>;
}

function Choice({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition disabled:opacity-60 sm:h-9 ${
        selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}>
      {selected && <Check size={14} />}
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} {hint && <span className="font-normal normal-case tracking-normal text-slate-400">&middot; {hint}</span>}
      </p>
      {children}
    </div>
  );
}

/** Late-by choices; a value outside the presets switches to a minutes field. */
export function LateMinutesPicker({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  /** `preset` is true when one of the choices was tapped (not while typing custom minutes). */
  onChange: (minutes: number | undefined, preset: boolean) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState(() => value !== undefined && !LATE_MINUTES.includes(value));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {LATE_MINUTES.map((minutes) => (
          <Choice key={minutes} disabled={disabled} selected={!custom && value === minutes}
            onClick={() => { setCustom(false); onChange(value === minutes && !custom ? undefined : minutes, true); }}>
            {formatLate(minutes)}
          </Choice>
        ))}
        <Choice disabled={disabled} selected={custom} onClick={() => setCustom(!custom)}>Custom</Choice>
      </div>
      {custom && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="number" inputMode="numeric" min={1} max={MAX_LATE_MINUTES} className="input w-28" autoFocus disabled={disabled}
            value={value ?? ''} placeholder="Minutes"
            onChange={(event) => {
              const minutes = Number.parseInt(event.target.value, 10);
              onChange(Number.isNaN(minutes) ? undefined : Math.min(MAX_LATE_MINUTES, Math.max(1, minutes)), false);
            }} />
          minutes
        </label>
      )}
    </div>
  );
}

/**
 * Everything recorded for one student, for the button already chosen: a present student's
 * discipline (late - with by how much - no uniform, no ID tag), an absent student's reason, and a
 * note. `showStatus` adds the Present / Absent choice (for corrections, where there is no row
 * with P and A). Controlled - every change is passed straight up, so there is nothing to lose.
 */
export function MarkEditor({
  value,
  onChange,
  parentNotifiable,
  disabled = false,
  showStatus = false,
}: {
  value: AttendanceMark;
  onChange: (mark: AttendanceMark) => void;
  parentNotifiable?: boolean;
  disabled?: boolean;
  showStatus?: boolean;
}) {
  const away = isAway(value.status);
  const late = value.status === 'LATE';
  return (
    <div className="space-y-4">
      {showStatus && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Attendance">
          {MARKING_STATUSES.map((status) => {
            const selected = markingStatus(value.status) === status;
            return (
              <button key={status} type="button" role="radio" aria-checked={selected} disabled={disabled}
                onClick={() => onChange(choose(value, status))}
                className={`h-11 rounded-lg border text-sm font-semibold transition disabled:opacity-60 ${
                  selected ? STATUS_STYLE[status].selected : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}>
                {STATUS_STYLE[status].label}
              </button>
            );
          })}
        </div>
      )}

      {away ? (
        <Section title="Absence notification">
          <div className="flex flex-wrap gap-2">
            {ABSENCE_REASONS.map((reason) => (
              <Choice key={reason} disabled={disabled} selected={(value.absenceReason ?? 'NOT_INFORMED') === reason}
                onClick={() => onChange({ ...value, absenceReason: reason })}>
                {titleCase(reason)}
              </Choice>
            ))}
          </div>
        </Section>
      ) : (
        <>
          <Section title="Discipline">
            <div className="flex flex-wrap gap-2">
              <Choice disabled={disabled} selected={late} onClick={() => onChange(withLate(value, !late))}>
                <Clock size={15} /> Late
              </Choice>
              <Choice disabled={disabled} selected={value.noUniform} onClick={() => onChange({ ...value, noUniform: !value.noUniform })}>
                <Shirt size={15} /> No uniform
              </Choice>
              <Choice disabled={disabled} selected={value.noIdTag} onClick={() => onChange({ ...value, noIdTag: !value.noIdTag })}>
                <IdCard size={15} /> No ID tag
              </Choice>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">No uniform and no ID tag are also added to the discipline records.</p>
          </Section>
          {late && (
            <Section title="Late by">
              <LateMinutesPicker value={value.lateMinutes} disabled={disabled}
                onChange={(lateMinutes) => onChange({ ...value, lateMinutes })} />
            </Section>
          )}
        </>
      )}

      <Section title="Note" hint="optional">
        <input className="input" maxLength={255} disabled={disabled} placeholder="Add a note" value={value.remarks ?? ''}
          onChange={(event) => onChange({ ...value, remarks: event.target.value })} />
      </Section>

      {parentNotifiable !== undefined && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          {parentNotifiable
            ? 'The parent gets one WhatsApp message when the student is marked absent or late.'
            : <><BellOff size={12} /> This parent does not receive WhatsApp messages.</>}
        </p>
      )}
    </div>
  );
}
