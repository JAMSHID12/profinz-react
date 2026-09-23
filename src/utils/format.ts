/**
 * Display helpers. Currency, locale and timezone come from the client configuration
 * (GET /api/config/public) at start-up, so nothing client-specific is compiled in.
 */
const settings = {
  currency: 'INR',
  locale: 'en-IN',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export function configureFormatting(options: { currency?: string; locale?: string; timezone?: string }) {
  if (options.currency) settings.currency = options.currency;
  if (options.locale) settings.locale = options.locale;
  if (options.timezone) settings.timezone = options.timezone;
}

/** Today's date (yyyy-MM-dd) in the client's timezone, not the browser's. */
export function todayIso(): string {
  return isoInZone(new Date());
}

export function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoInZone(date);
}

function isoInZone(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** The current time (HH:mm) in the client's timezone. */
export function nowTime(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

/** Adds days to an ISO date without timezone surprises. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(settings.locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDay(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(settings.locale, { weekday: 'short', day: '2-digit', month: 'short' });
}

/** "17 Sep" - for chart axes and compact lists. */
export function formatShortDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(settings.locale, { day: '2-digit', month: 'short' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(settings.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(value?: number | null): string {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(settings.locale, {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/** A count with the locale's digit grouping ("1,248"). */
export function formatCount(value: number): string {
  try {
    return new Intl.NumberFormat(settings.locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${Number(value).toFixed(1)}%`;
}

export function formatMarks(marks?: number | null, max?: number | null): string {
  if (marks === undefined || marks === null) return '-';
  return max ? `${marks} / ${max}` : String(marks);
}

export function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const ROLE_LABELS: Record<string, string> = {
  DIRECTORS: 'Director',
  ADMINISTRATIVE: 'Administrator',
  SALES: 'Sales',
  ACCOUNTS: 'Accounts',
  ACADEMICS: 'Academics',
  STUDENTS: 'Student',
  MENTORS: 'Mentor',
  FACULTY: 'Faculty',
};
