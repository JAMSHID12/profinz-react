import { createContext, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronsUpDown } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';
import { Calendar } from './ui/calendar';
import './pickers.css';
export const FieldLabelContext = createContext('');
export type SelectOption = { value: string | number; label: string };
type SearchableProps = {
  value: string | number | null | undefined; onChange: (value: string) => void; options: SelectOption[];
  placeholder?: string; disabled?: boolean; required?: boolean; id?: string; name?: string; className?: string;
  'aria-label'?: string; allowCustom?: boolean;
  loadOptions?: (search: string) => Promise<SelectOption[]>;
};
export function SearchableSelect({ value, onChange, options, placeholder = 'Select', disabled, required, id, name, className = 'input', 'aria-label': ariaLabel, allowCustom, loadOptions }: SearchableProps) {
  const label = useContext(FieldLabelContext) || ariaLabel || placeholder;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const selectedCache = useRef<SelectOption>();
  const trigger = useRef<HTMLButtonElement>(null);
  const loader = useRef(loadOptions); loader.current = loadOptions;
  const server = !!loadOptions;
  useEffect(() => {
    if (!open || !server) return;
    let active = true;
    setLoading(true); setError(false);
    const timer = setTimeout(() => { void loader.current!(search).then(items => { if (active) setRemote(items); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search, open, server, loadOptions]);
  const current = [...options, ...remote].find(item => String(item.value) === String(value));
  if (current) selectedCache.current = current;
  const selected = current ?? (String(selectedCache.current?.value) === String(value) ? selectedCache.current : undefined);
  const choose = (next: string) => { onChange(next); setOpen(false); setSearch(''); };
  return <span className="picker-field">
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger asChild><button ref={trigger} id={id} type="button" role="combobox" aria-label={ariaLabel || label} aria-expanded={open} aria-required={required} disabled={disabled}
        className={`${className} flex w-full min-w-0 items-center justify-between gap-2 text-left`}><span className="truncate">{selected?.label ?? (value ? String(value) : placeholder)}</span><ChevronsUpDown size={15} className="shrink-0 text-slate-400" /></button></PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] max-w-[calc(100vw-24px)]" align="start">
        <Command shouldFilter={!server}><CommandInput aria-label={`Search ${label}`} placeholder="Search…" value={search} onValueChange={setSearch} />
          <CommandList>{loading ? <div role="status" className="p-3 text-sm text-slate-500">Searching…</div> : error ? <div role="alert" className="p-3 text-sm text-rose-600">Could not load results. Close and try again.</div> : <>
            {server && remote.length === 0 ? <div className="p-4 text-center text-sm text-slate-500">No results found</div> : <CommandEmpty>No results found</CommandEmpty>}
            {!required && <CommandItem value={`clear ${placeholder}`} onSelect={() => choose('')}>{placeholder}</CommandItem>}
            {(server ? remote : options).map(item => <CommandItem key={item.value} value={`${item.label} ${item.value}`} onSelect={() => { selectedCache.current = item; choose(String(item.value)); }}><Check size={15} className={String(value) === String(item.value) ? 'shrink-0' : 'shrink-0 opacity-0'} /><span>{item.label}</span></CommandItem>)}
            {allowCustom && search.trim() && !options.some(item => item.label.toLowerCase() === search.trim().toLowerCase()) && <CommandItem value={search} onSelect={() => choose(search.trim())}>Use “{search.trim()}”</CommandItem>}
          </>}</CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <input className="picker-validation" tabIndex={-1} aria-hidden="true" name={name} value={value ?? ''} required={required} disabled={disabled} onChange={() => {}} onInvalid={event => { event.preventDefault(); trigger.current?.focus(); setOpen(true); }} />
  </span>;
}
type DateProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & { value?: string | number; onChange?: (event: { target: { value: string } }) => void; triggerLabel?: string };
export function DatePicker({ value, onChange, min, max, required, disabled, readOnly, name, id, className = 'input', 'aria-label': ariaLabel, triggerLabel, ...rest }: DateProps) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const validation = useRef<HTMLInputElement>(null);
  const date = value ? parseISO(String(value)) : undefined;
  const selected = date && isValid(date) ? date : undefined;
  const lower = min ? parseISO(String(min)) : undefined;
  const upper = max ? parseISO(String(max)) : undefined;
  useEffect(() => {
    const raw = String(value ?? '');
    const invalid = raw && (!isValid(parseISO(raw)) || (min && raw < String(min)) || (max && raw > String(max)));
    validation.current?.setCustomValidity(invalid ? 'Choose a date within the allowed range.' : '');
  }, [value, min, max]);
  return <span className="picker-field"><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button id={id ?? generatedId} ref={trigger} type="button" aria-label={ariaLabel || fieldLabel || 'Choose date'} aria-required={required} disabled={disabled || readOnly} className={`${className} flex w-full items-center justify-between gap-2 text-left`}><span className="truncate">{triggerLabel ?? (selected ? format(selected, 'dd/MM/yyyy') : 'Select date')}</span><CalendarDays size={16} className="shrink-0 text-slate-500" /></button></PopoverTrigger>
    <PopoverContent align="start" className="p-3"><Calendar mode="single" selected={selected} defaultMonth={selected ?? lower} startMonth={lower ?? new Date(1900, 0)} endMonth={upper ?? new Date(new Date().getFullYear() + 20, 11)} disabled={[...(lower ? [{ before: lower }] : []), ...(upper ? [{ after: upper }] : [])]} onSelect={next => { if (next) { onChange?.({ target: { value: format(next, 'yyyy-MM-dd') } }); setOpen(false); } }} />
      {!required && <button type="button" className="mt-2 w-full rounded-md p-2 text-sm text-slate-600 hover:bg-slate-100" onClick={() => { onChange?.({ target: { value: '' } }); setOpen(false); }}>Clear date</button>}
    </PopoverContent></Popover>
    <input ref={validation} className="picker-validation" tabIndex={-1} aria-hidden="true" name={name} value={value ?? ''} required={required} disabled={disabled} onChange={() => {}} onInvalid={event => { event.preventDefault(); trigger.current?.focus(); setOpen(true); }} form={rest.form} />
  </span>;
}
export function TimeSelect({ value, onChange, min, max, className = 'input', ...rest }: DateProps) {
  const label = useContext(FieldLabelContext);
  const current = String(value ?? '').slice(0, 5);
  return <select id={rest.id} name={rest.name} required={rest.required} disabled={rest.disabled || rest.readOnly} aria-label={rest['aria-label'] || label || undefined} className={className} value={current} onChange={event => onChange?.({ target: { value: event.target.value } })}>
    <option value="">Select time</option>
    {Array.from({ length: 1440 }, (_, minute) => { const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; return <option key={time} value={time} disabled={!!(min && time < String(min)) || !!(max && time > String(max))}>{`${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute < 720 ? 'AM' : 'PM'}`}</option>; })}
  </select>;
}
