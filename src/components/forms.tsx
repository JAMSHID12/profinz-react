import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { Ref } from '../types';
import { titleCase } from '../utils/format';

export function Field({
  label,
  children,
  error,
  hint,
  className = 'mb-4',
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

type Option = { value: string | number; label: string };

/** Options for a select from id/name references or enum values. */
export function refOptions(items: { id: number; name?: string; fullName?: string }[]): Option[] {
  return items.map((item) => ({ value: item.id, label: item.name ?? item.fullName ?? String(item.id) }));
}

export function enumOptions(values: readonly string[]): Option[] {
  return values.map((value) => ({ value, label: titleCase(value) }));
}

export function refLabel(ref?: Ref | null): string {
  return ref?.name ?? '-';
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <select className="input" value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string | number | undefined | null;
  onChange: (value: string) => void;
}) {
  return <input className="input" value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...rest} />;
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string | undefined | null;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className="input"
      rows={rows}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/** Turns "" into undefined and numeric strings into numbers for request bodies. */
export function numberOrUndefined(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

export function blankToUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return value === null || value === undefined ? undefined : String(value);
  return value.trim() === '' ? undefined : value.trim();
}

/** A row of filters above a table. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="no-print grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
