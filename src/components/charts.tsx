import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from 'react';
import type { AttendanceStatus, AttendanceSummary } from '../types';
import { formatCount } from '../utils/format';

/**
 * Small SVG/HTML charts with no library. Marks stay thin, gridlines are solid hairlines, every
 * chart has a hover/focus readout, and values are also written out (legend, labels or a table)
 * so colour is never the only way to read them.
 */

/** Status colours, validated as a set for colour-blind separation (stack order below). */
export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: '#059669',
  LATE: '#f59e0b',
  EXCUSED: '#0284c7',
  HOLIDAY: '#94a3b8',
  ABSENT: '#e11d48',
};

/** Part-to-whole order: attended first (present, late), then away (excused, absent). */
export const STACK_ORDER: AttendanceStatus[] = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  EXCUSED: 'Excused',
  HOLIDAY: 'Holiday',
  ABSENT: 'Absent',
};

const GRID = '#e2e8f0';
const AXIS_TEXT = '#64748b';

export function countOf(summary: AttendanceSummary, status: AttendanceStatus): number {
  switch (status) {
    case 'PRESENT': return summary.present;
    case 'LATE': return summary.late;
    case 'EXCUSED': return summary.excused;
    case 'HOLIDAY': return 0;
    default: return summary.absent;
  }
}

export function percentOf(part: number, total: number): string {
  return total === 0 ? '0%' : `${Math.round((part * 1000) / total) / 10}%`;
}

function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A tooltip row: a short line key in the series colour, the value first, then the name. */
export function TooltipRow({ color, value, label }: { color: string; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

export function LegendSwatch({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />;
}

/** One legend for the statuses (all four unless narrowed), for charts that show them. */
export function StatusLegend({ className = '', statuses = STACK_ORDER }: { className?: string; statuses?: AttendanceStatus[] }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 ${className}`}>
      {statuses.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <LegendSwatch color={STATUS_COLORS[status]} />
          {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}

// ---- Donut -------------------------------------------------------------------------------------

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Part-to-whole at a glance (four segments at most here). The centre shows the headline and,
 * while a segment or legend row is hovered or focused, that segment's value. The legend beside it
 * lists every value, so the chart never has to be hovered to be read.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 20,
  layout = 'row',
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
  /** 'row' puts the legend beside the ring from small screens up; 'column' always puts it below. */
  layout?: 'row' | 'column';
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const drawn = segments.filter((segment) => segment.value > 0);
  const gap = drawn.length > 1 ? 2 : 0;
  const activeSegment = segments.find((segment) => segment.key === active);

  let offset = 0;
  return (
    <div className={`flex flex-col items-center gap-4 ${layout === 'row' ? 'sm:flex-row sm:items-center' : ''}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${centerLabel}: ${centerValue}. ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {drawn.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dash = Math.max(length - gap, 0.75);
            const element = (
              <circle
                key={segment.key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={active === segment.key ? thickness + 4 : thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${center} ${center})`}
                opacity={active && active !== segment.key ? 0.45 : 1}
                className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                onPointerEnter={() => setActive(segment.key)}
                onPointerLeave={() => setActive(null)}
              />
            );
            offset += length;
            return element;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          {activeSegment ? (
            <>
              <span className="text-2xl font-semibold text-slate-900">{activeSegment.value}</span>
              <span className="text-xs text-slate-500">
                {activeSegment.label} &middot; {percentOf(activeSegment.value, total)}
              </span>
            </>
          ) : (
            <>
              <span className="text-3xl font-semibold text-slate-900">{centerValue}</span>
              <span className="text-xs text-slate-500">{centerLabel}</span>
            </>
          )}
        </div>
      </div>
      <ul className={`w-full min-w-0 space-y-1 ${layout === 'row' ? 'sm:w-auto sm:flex-1' : ''}`}>
        {segments.map((segment) => (
          <li key={segment.key}>
            <button type="button"
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition ${
                active === segment.key ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(segment.key)}
              onBlur={() => setActive(null)}>
              <LegendSwatch color={segment.color} />
              <span className="flex-1 text-slate-700">{segment.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{segment.value}</span>
              <span className="w-12 text-right text-xs tabular-nums text-slate-500">{percentOf(segment.value, total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The four statuses of a summary as donut segments, in stack order. */
export function statusSegments(summary: AttendanceSummary): DonutSegment[] {
  return STACK_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: countOf(summary, status),
    color: STATUS_COLORS[status],
  }));
}

// ---- Trend -------------------------------------------------------------------------------------

export interface RatePoint {
  /** Under the axis ("17 Sep", "W3"). */
  label: string;
  /** At the top of the readout ("Tue, 17 Sep", "W3 · 1 Sep – 7 Sep"). */
  title: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
}

export const PREVIOUS_COLOR = '#94a3b8';

function rateOf(point?: RatePoint): number | null {
  if (!point) return null;
  const total = point.present + point.late + point.excused + point.absent;
  return total === 0 ? null : ((point.present + point.late) * 100) / total;
}

/** Consecutive points that have a value form one line; a point without one breaks it. */
function runsOf(rates: (number | null)[]): number[][] {
  const runs: number[][] = [];
  rates.forEach((rate, index) => {
    if (rate === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === index - 1) last.push(index);
    else runs.push([index]);
  });
  return runs;
}

/**
 * Attendance rate over time on one axis. The current period is the brand line with a light wash;
 * with `previous`, the period before is a grey line on the same axis, point for point. A crosshair
 * snaps to the nearest point and the readout lists every status; arrow keys move it too.
 */
export function RateTrendChart({ points, previous, height = 220 }: { points: RatePoint[]; previous?: RatePoint[]; height?: number }) {
  const [containerRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const rates = points.map(rateOf);
  const previousRates = points.map((_, index) => rateOf(previous?.[index]));
  const known = [...rates, ...previousRates].filter((rate): rate is number => rate !== null);
  const low = known.length ? Math.min(...known) : 100;
  // Zoom in on the band the data lives in, in steps of 10, always ending at 100%.
  const min = Math.max(0, Math.min(90, Math.floor((low - 5) / 10) * 10));
  const step = 100 - min > 50 ? 25 : 10;
  const ticks: number[] = [];
  for (let tick = min; tick <= 100; tick += step) ticks.push(tick);

  const left = 40;
  const right = 16;
  const top = 12;
  const bottom = 24;
  const plotWidth = Math.max(0, width - left - right);
  const plotHeight = height - top - bottom;
  const n = points.length;
  const x = (index: number) => left + (n <= 1 ? plotWidth / 2 : (index * plotWidth) / (n - 1));
  const y = (rate: number) => top + plotHeight * (1 - (rate - min) / (100 - min));
  const baseline = y(min);

  const path = (series: (number | null)[], run: number[]) =>
    run.map((index, i) => `${i === 0 ? 'M' : 'L'}${x(index)},${y(series[index]!)}`).join(' ');
  const runs = runsOf(rates);
  const previousRuns = runsOf(previousRates);

  // As many axis labels as fit, evenly spaced. The last point is always labelled: added when there
  // is room for it, otherwise in place of the label before it.
  const LABEL_SPACE = 56;
  const fit = Math.max(2, Math.floor(plotWidth / LABEL_SPACE));
  const every = Math.max(1, Math.ceil(n / fit));
  const labelIndexes: number[] = [];
  for (let index = 0; index < n; index += every) labelIndexes.push(index);
  const lastLabel = labelIndexes[labelIndexes.length - 1];
  if (n > 1 && lastLabel !== n - 1) {
    if (x(n - 1) - x(lastLabel) >= LABEL_SPACE) labelIndexes.push(n - 1);
    else if (labelIndexes.length > 1) labelIndexes[labelIndexes.length - 1] = n - 1;
  }
  const lastKnown = rates.reduce<number | null>((found, rate, index) => (rate !== null ? index : found), null);

  const nearest = (clientX: number, target: Element) => {
    const bounds = target.getBoundingClientRect();
    const position = clientX - bounds.left - left;
    return Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (position / plotWidth) * (n - 1))));
  };
  const onPointerMove = (event: PointerEvent<SVGRectElement>) => setHover(nearest(event.clientX, event.currentTarget.ownerSVGElement!));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const current = hover ?? n - 1;
    const next = event.key === 'ArrowLeft' ? current - 1 : event.key === 'ArrowRight' ? current + 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setHover(Math.max(0, Math.min(n - 1, next)));
  };

  const hovered = hover === null ? null : points[hover];
  const hoveredRate = hover === null ? null : rates[hover];
  const hoveredPrevious = hover === null ? null : previousRates[hover];
  // The readout sits beside the crosshair, on the side with more room, so it never hides the line.
  const readoutLeft = hover === null ? 0 : x(hover) > width / 2 ? x(hover) - 12 : x(hover) + 12;
  const readoutShift = hover !== null && x(hover) > width / 2 ? '-100%' : '0';
  const format = (rate: number) => `${Math.round(rate * 10) / 10}%`;

  return (
    <div ref={containerRef} style={{ height }} className="relative w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-300" tabIndex={0}
      role="group" aria-label="Attendance rate over time. Use the arrow keys to read each point."
      onKeyDown={onKeyDown} onFocus={() => n > 0 && setHover((current) => current ?? lastKnown ?? n - 1)} onBlur={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0 block">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}
                style={{ fontVariantNumeric: 'tabular-nums' }}>{tick}%</text>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text key={index} x={x(index)} y={height - 6} fontSize={11} fill={AXIS_TEXT}
              textAnchor={index === 0 && n > 1 ? 'start' : index === n - 1 && n > 1 ? 'end' : 'middle'}>
              {points[index]?.label}
            </text>
          ))}
          {previousRuns.map((run) => (
            <path key={`p${run[0]}`} d={path(previousRates, run)} fill="none" stroke={PREVIOUS_COLOR} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {runs.map((run) => (
            <path key={`a${run[0]}`} d={`${path(rates, run)} L${x(run[run.length - 1])},${baseline} L${x(run[0])},${baseline} Z`}
              className="fill-brand-600/10" />
          ))}
          {runs.map((run) => (
            <path key={`l${run[0]}`} d={path(rates, run)} fill="none" className="stroke-brand-600" strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {runs.filter((run) => run.length === 1).map((run) => (
            <circle key={`s${run[0]}`} cx={x(run[0])} cy={y(rates[run[0]]!)} r={3} className="fill-brand-600" />
          ))}
          {lastKnown !== null && hover === null && (() => {
            const cy = y(rates[lastKnown]!);
            // The end label goes below the point when the point is too close to the top.
            const labelY = cy - 10 < top + 4 ? cy + 18 : cy - 10;
            return (
              <>
                <circle cx={x(lastKnown)} cy={cy} r={4} className="fill-brand-600" stroke="#fff" strokeWidth={2} />
                <text x={x(lastKnown) - 8} y={labelY} textAnchor="end" fontSize={11} fontWeight={600} fill="#0f172a"
                  stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {format(rates[lastKnown]!)}
                </text>
              </>
            );
          })()}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotHeight} stroke="#94a3b8" strokeWidth={1} />
              {hoveredPrevious !== null && (
                <circle cx={x(hover)} cy={y(hoveredPrevious)} r={4} fill={PREVIOUS_COLOR} stroke="#fff" strokeWidth={2} />
              )}
              {hoveredRate !== null && (
                <circle cx={x(hover)} cy={y(hoveredRate)} r={4} className="fill-brand-600" stroke="#fff" strokeWidth={2} />
              )}
            </>
          )}
          <rect x={left} y={0} width={plotWidth} height={height} fill="transparent"
            onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hovered && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-lg"
          style={{ left: readoutLeft, transform: `translateX(${readoutShift})` }}>
          <p className="mb-1 font-medium text-slate-500">{hovered.title}</p>
          {hoveredRate === null ? (
            <p className="text-slate-500">No attendance taken</p>
          ) : (
            <div className="space-y-0.5">
              <p className="mb-1 text-sm font-semibold text-slate-900">
                {format(hoveredRate)} <span className="text-xs font-normal text-slate-500">attended</span>
              </p>
              <TooltipRow color={STATUS_COLORS.PRESENT} label="on time" value={formatCount(hovered.present)} />
              <TooltipRow color={STATUS_COLORS.LATE} label="late" value={formatCount(hovered.late)} />
              <TooltipRow color={STATUS_COLORS.ABSENT} label="absent" value={formatCount(hovered.absent + hovered.excused)} />
            </div>
          )}
          {previous && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <TooltipRow color={PREVIOUS_COLOR} label="previous period" value={hoveredPrevious === null ? '–' : format(hoveredPrevious)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Bars --------------------------------------------------------------------------------------

export interface BarRow {
  key: string | number;
  label: string;
  value: number;
  /** The value as written at the bar's end (defaults to the number). */
  display?: string;
  sublabel?: string;
}

/**
 * One measure across named rows, as horizontal bars in a single colour (the rows are names, not a
 * scale). Thin bars, square at the start and rounded at the end, with the value written at the tip.
 * A `threshold` draws a hairline at that value in every track and writes the values under it in red.
 */
export function BarList({ rows, max, color = '#334155', labelWidth = '7.5rem', valueWidth = '3.25rem', threshold, onSelect }: {
  rows: BarRow[];
  max?: number;
  color?: string;
  labelWidth?: string;
  valueWidth?: string;
  threshold?: number;
  onSelect?: (key: string | number) => void;
}) {
  const top = max ?? Math.max(1, ...rows.map((row) => row.value));
  // The label column never takes more than 40% of the row, so narrow screens keep a readable bar.
  const grid = { gridTemplateColumns: `min(${labelWidth}, 40%) minmax(0,1fr) ${valueWidth}` };
  return (
    <ul className="space-y-0.5">
      {rows.map((row) => {
        const below = threshold !== undefined && row.value < threshold;
        const content = (
          <>
            <span className="min-w-0">
              <span className="block truncate text-sm text-slate-700">{row.label}</span>
              {row.sublabel && <span className="block truncate text-[11px] text-slate-400">{row.sublabel}</span>}
            </span>
            <span className="relative h-2.5 rounded-sm bg-slate-100">
              <span className="absolute inset-y-0 left-0 rounded-r"
                style={{ width: `${Math.max(0, Math.min(100, (row.value / top) * 100))}%`, background: color }} />
              {threshold !== undefined && (
                <span className="absolute -inset-y-1 w-px bg-slate-400" style={{ left: `${(threshold / top) * 100}%` }} aria-hidden="true" />
              )}
            </span>
            <span className={`text-right text-sm font-semibold tabular-nums ${below ? 'text-rose-700' : 'text-slate-900'}`}>
              {row.display ?? row.value}
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(row.key)} style={grid}
                className="grid w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50">
                {content}
              </button>
            ) : (
              <div style={grid} className="grid items-center gap-3 px-1.5 py-1.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---- Stacked columns -------------------------------------------------------------------------------

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
}

/** A round axis maximum: 1, 2 or 5 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

/**
 * Counts over time, one column per period, the series stacked with 2px gaps and a rounded top.
 * Hovering or focusing a column reads out every series for it.
 */
export function StackedColumns({ columns, series, height = 180 }: {
  columns: { key: string; label: string; title: string; values: Record<string, number> }[];
  series: ColumnSeries[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = columns.map((column) => series.reduce((sum, item) => sum + (column.values[item.key] ?? 0), 0));
  const top = niceMax(Math.max(0, ...totals));
  const ticks = [0, top / 2, top];
  const hovered = hover === null ? null : columns[hover];

  return (
    <div className="relative">
      <div className="relative pl-8" style={{ height }}>
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 flex translate-y-1/2 items-center" style={{ bottom: `${(tick / top) * 100}%` }}>
            <span className="w-7 pr-1 text-right text-[11px] tabular-nums text-slate-400">{Math.round(tick)}</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        ))}
        <div className="relative flex h-full items-end gap-1.5 pl-1">
          {columns.map((column, index) => {
            const visible = series.filter((item) => (column.values[item.key] ?? 0) > 0);
            return (
              <button key={column.key} type="button" aria-label={`${column.title}: ${series.map((item) => `${item.label} ${column.values[item.key] ?? 0}`).join(', ')}`}
                onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(index)} onBlur={() => setHover(null)}
                className={`flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-brand-300 ${hover === index ? 'bg-slate-100' : ''}`}>
                <span className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]" style={{ height: `${(totals[index] / top) * 100}%` }}>
                  {visible.map((item, i) => (
                    <span key={item.key} className={i === visible.length - 1 ? 'rounded-t' : ''}
                      style={{ flexGrow: column.values[item.key], flexBasis: 0, background: item.color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5 pl-9">
        {columns.map((column) => (
          <span key={column.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{column.label}</span>
        ))}
      </div>
      {hovered && hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-lg"
          style={{
            left: `calc(2.25rem + (100% - 2.25rem) * ${(hover + 0.5) / columns.length})`,
            transform: hover >= columns.length / 2 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
          }}>
          <p className="mb-1 font-medium text-slate-500">{hovered.title}</p>
          <p className="mb-1 text-sm font-semibold text-slate-900">{totals[hover]} <span className="text-xs font-normal text-slate-500">in total</span></p>
          {series.map((item) => (
            <TooltipRow key={item.key} color={item.color} label={item.label} value={hovered.values[item.key] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Meter -------------------------------------------------------------------------------------

/** Attendance tone: 90% and above is good, below 75% needs attention. */
export function attendanceTone(percentage: number): { fill: string; track: string; text: string } {
  if (percentage >= 90) return { fill: 'bg-emerald-600', track: 'bg-emerald-100', text: 'text-slate-900' };
  if (percentage >= 75) return { fill: 'bg-amber-500', track: 'bg-amber-100', text: 'text-slate-900' };
  return { fill: 'bg-rose-600', track: 'bg-rose-100', text: 'text-rose-700' };
}

export function Meter({ value, className = '' }: { value: number; className?: string }) {
  const tone = attendanceTone(value);
  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${tone.track} ${className}`}>
      <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
