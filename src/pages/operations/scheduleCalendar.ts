import { addDays } from '../../utils/format';
import type { ScheduleEntry } from '../../types';

export type CalendarView = 'Month' | 'Week' | 'Day';
/** Times use minute precision, matching the scheduling form and API. */
export const isPastStart = (date: string, time: string | undefined, today: string, now: string) =>
  date < today || (date === today && (time || '23:59').slice(0, 5) <= now);
export const dateObject = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const dateLabel = (iso: string, options: Intl.DateTimeFormatOptions) =>
  dateObject(iso).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
export const weekStart = (iso: string) => addDays(iso, -dateObject(iso).getUTCDay());
export function moveMonth(iso: string, amount: number) {
  const date = dateObject(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function calendarRange(date: string, view: CalendarView) {
  if (view === 'Day') return { from: date, to: date };
  if (view === 'Week') {
    const from = weekStart(date);
    return { from, to: addDays(from, 6) };
  }
  const first = `${date.slice(0, 7)}-01`;
  return { from: weekStart(first), to: addDays(weekStart(addDays(moveMonth(first, 1), -1)), 6) };
}
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeValue = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const timeLabel = (value: number) => `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, '0')} ${value < 720 ? 'AM' : 'PM'}`;

/** Assign simultaneous classes separate columns, including chains of overlapping classes. */
export function layoutEvents(entries: ScheduleEntry[]) {
  const sorted = [...entries].sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || minutes(b.endTime) - minutes(a.endTime));
  const result: { entry: ScheduleEntry; column: number; columns: number }[] = [];
  let group: typeof result = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    group.forEach(item => { item.columns = ends.length; result.push(item); });
    group = []; ends = [];
  };
  for (const entry of sorted) {
    const start = minutes(entry.startTime);
    if (start >= groupEnd) flush();
    let column = ends.findIndex(end => end <= start);
    if (column < 0) column = ends.length;
    ends[column] = minutes(entry.endTime);
    group.push({ entry, column, columns: 1 });
    groupEnd = Math.max(groupEnd, minutes(entry.endTime));
  }
  flush();
  return result;
}
