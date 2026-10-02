import * as Primitive from '@radix-ui/react-popover';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverContent = forwardRef<ElementRef<typeof Primitive.Content>, ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className = '', sideOffset = 5, ...props }, ref) => (
  <Primitive.Portal><Primitive.Content ref={ref} sideOffset={sideOffset} collisionPadding={12}
    className={`z-[80] rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-lg outline-none ${className}`} {...props} /></Primitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';
