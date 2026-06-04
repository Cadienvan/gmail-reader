import React from 'react';
import { cn } from './cn';

/** Shared field styling used by Input, Textarea and Select. */
export const FIELD_BASE =
  'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ' +
  'placeholder-gray-400 dark:placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Render with a monospace font (regex, keys, API keys). */
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ mono = false, className, type = 'text', ...rest }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(FIELD_BASE, mono && 'font-mono text-sm', className)}
      {...rest}
    />
  )
);

Input.displayName = 'Input';
