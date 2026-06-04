import React from 'react';
import { cn } from './cn';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a red asterisk after the label text. */
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({ required, className, children, ...rest }) => (
  <label
    className={cn('block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', className)}
    {...rest}
  >
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);
