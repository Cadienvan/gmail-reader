import React from 'react';
import { cn } from './cn';
import { FIELD_BASE } from './Input';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cn(FIELD_BASE, 'pr-8', className)} {...rest}>
      {children}
    </select>
  )
);

Select.displayName = 'Select';
