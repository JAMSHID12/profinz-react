import { Command as Primitive } from 'cmdk';
import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
export const Command = Primitive;
export function CommandInput(props: ComponentProps<typeof Primitive.Input>) {
  return <div className="flex items-center gap-2 border-b border-slate-100 px-2"><Search size={16} className="shrink-0 text-slate-400" /><Primitive.Input {...props} className="h-10 w-full bg-transparent text-sm outline-none" /></div>;
}
export function CommandList(props: ComponentProps<typeof Primitive.List>) { return <Primitive.List {...props} className="max-h-60 overflow-y-auto overscroll-contain p-1" />; }
export function CommandEmpty(props: ComponentProps<typeof Primitive.Empty>) { return <Primitive.Empty {...props} className="p-4 text-center text-sm text-slate-500" />; }
export function CommandItem(props: ComponentProps<typeof Primitive.Item>) { return <Primitive.Item {...props} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-700" />; }
