import React from 'react';
import { cn } from './cn';

/** Shared field styling used by Input, Textarea and Select. */
export const FIELD_BASE =
  'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ' +
  'placeholder-gray-400 dark:placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/** Shell used when the field has adornments: the focus ring moves to the container. */
const FIELD_SHELL =
  'w-full flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ' +
  'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500';

// `prefix` shadows the (unused) native global attribute of the same name.
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** Render with a monospace font (regex, keys, API keys). */
  mono?: boolean;
  /** Read-only decoration rendered before the field (e.g. a fixed query prefix). Not part of `value`. */
  prefix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ mono = false, prefix, className, type = 'text', ...rest }, ref) => {
    if (prefix === undefined || prefix === null) {
      return (
        <input
          ref={ref}
          type={type}
          className={cn(FIELD_BASE, mono && 'font-mono text-sm', className)}
          {...rest}
        />
      );
    }

    return (
      <div className={cn(FIELD_SHELL, rest.disabled && 'opacity-50', className)}>
        <span
          className="shrink-0 max-w-[45%] truncate select-none font-mono text-xs text-gray-500 dark:text-gray-400"
          title={typeof prefix === 'string' ? prefix : undefined}
        >
          {prefix}
        </span>
        <input
          ref={ref}
          type={type}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'disabled:cursor-not-allowed',
            mono && 'font-mono text-sm'
          )}
          {...rest}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
