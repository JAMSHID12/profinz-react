import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { titleCase } from '../utils/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-rose-600',
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`mt-2 truncate text-2xl font-semibold ${tones[tone]}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 rounded-lg bg-brand-50 p-2 text-brand-600">{icon}</div>}
      </div>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  LATE: 'bg-amber-100 text-amber-700',
  EXCUSED: 'bg-sky-100 text-sky-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
  WAIVED: 'bg-violet-100 text-violet-700',
  SENT: 'bg-emerald-100 text-emerald-700',
  PROCESSING: 'bg-sky-100 text-sky-700',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  QUEUED: 'bg-sky-100 text-sky-700',
  SKIPPED: 'bg-slate-100 text-slate-500',
  NOT_REQUIRED: 'bg-slate-100 text-slate-400',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-200 text-slate-600',
  CLOSED: 'bg-slate-200 text-slate-600',
  PLANNED: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  DROPPED: 'bg-rose-100 text-rose-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-slate-100 text-slate-700',
  REVIEW: 'bg-amber-100 text-amber-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  NOT_STARTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-sky-100 text-sky-700',
  DELAYED: 'bg-rose-100 text-rose-700',
  OPEN: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  SCHEDULED: 'bg-sky-100 text-sky-700',
  FOLLOW_UP: 'bg-violet-100 text-violet-700',
  CURRENT: 'bg-emerald-100 text-emerald-700',
  TRANSFERRED: 'bg-slate-200 text-slate-600',
  PASS: 'bg-emerald-100 text-emerald-700',
  FAIL: 'bg-rose-100 text-rose-700',
  ENABLED: 'bg-emerald-100 text-emerald-700',
  DISABLED: 'bg-slate-200 text-slate-500',
};

export function Badge({ value, label, className = '' }: { value: string; label?: string; className?: string }) {
  const tone = BADGE_TONES[value] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`}>
      {label ?? titleCase(value)}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="animate-spin" size={18} />
      {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <AlertTriangle className="text-amber-500" size={22} />
      <p className="text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Renders loading / error / content for a query result. */
export function Loadable<T>({
  query,
  children,
}: {
  query: { data: T | null; loading: boolean; error: string | null; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (query.loading && query.data === null) return <Spinner />;
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />;
  if (query.data === null) return null;
  return <>{children(query.data)}</>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
  dismissible = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Close on a tap outside or Escape - for pickers that apply changes immediately, not for forms. */
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={dismissible ? (event) => event.target === event.currentTarget && onClose() : undefined}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-xl ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="px-4 py-3 text-xs text-slate-500">
        {totalElements} {totalElements === 1 ? 'record' : 'records'}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Page {page + 1} of {totalPages} - {totalElements} records
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; hidden?: boolean }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab ${active === tab.key ? 'tab-active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
    </div>
  );
}

export function ProgressBar({ value, tone = 'brand' }: { value?: number | null; tone?: 'brand' | 'positive' | 'danger' }) {
  const width = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = tone === 'positive' ? 'bg-emerald-500' : tone === 'danger' ? 'bg-rose-500' : 'bg-brand-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Label/value pairs for detail panels. */
export function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-800">{value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  const style =
    tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800';
  return <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</div>;
}
