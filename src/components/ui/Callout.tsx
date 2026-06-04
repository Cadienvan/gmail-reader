import React from 'react';
import { cn } from './cn';

export type CalloutVariant = 'info' | 'warning' | 'success' | 'danger';

const VARIANTS: Record<CalloutVariant, string> = {
  info:
    'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
  warning:
    'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200',
  success:
    'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
  danger:
    'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
};

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant;
  /** Optional leading icon (e.g. a lucide-react element). */
  icon?: React.ReactNode;
}

/** Inline info / warning / success / danger box. */
export const Callout: React.FC<CalloutProps> = ({
  variant = 'info',
  icon,
  className,
  children,
  ...rest
}) => (
  <div
    className={cn('rounded-md border p-3 text-sm', VARIANTS[variant], className)}
    {...rest}
  >
    {icon ? (
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0">{children}</div>
      </div>
    ) : (
      children
    )}
  </div>
);
