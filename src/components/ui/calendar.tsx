import { DayPicker } from 'react-day-picker';
import type { ComponentProps } from 'react';
import 'react-day-picker/style.css';
export function Calendar(props: ComponentProps<typeof DayPicker>) {
  return <DayPicker showOutsideDays captionLayout="dropdown" {...props} className="profinz-calendar" />;
}
