import React from 'react';
import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'danger' | 'success' | 'primary';
export type IconButtonSize = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center rounded-md transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:ring-gray-400',
  danger:
    'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 focus-visible:ring-red-500',
  success:
    'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 focus-visible:ring-green-500',
  primary:
    'text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 focus-visible:ring-blue-500',
};

const SIZES: Record<IconButtonSize, string> = {
  sm: 'p-1',
  md: 'p-2',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Accessible label — required since the button has no text. */
  label: string;
}

/**
 * Square, icon-only button. Use for close (X), inline edit, delete, etc.
 * Pass the lucide-react icon as the child.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'md', label, className, children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
