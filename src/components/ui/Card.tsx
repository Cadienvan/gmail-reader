import React from 'react';
import { cn } from './cn';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  padding?: CardPadding;
  /** Optional title rendered in a header row. */
  title?: React.ReactNode;
  /** Optional description shown under the title. */
  description?: React.ReactNode;
  /** Optional actions (e.g. buttons) rendered at the right of the header. */
  actions?: React.ReactNode;
}

/**
 * Neutral bordered container — the standard surface for config sections,
 * list items and grouped content.
 */
export const Card: React.FC<CardProps> = ({
  padding = 'md',
  title,
  description,
  actions,
  className,
  children,
  ...rest
}) => {
  const hasHeader = title || description || actions;
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50',
        PADDING[padding],
        className
      )}
      {...rest}
    >
      {hasHeader && (
        <div
          className={cn(
            'flex items-start justify-between gap-3',
            children ? 'mb-4' : ''
          )}
        >
          <div>
            {title && (
              <h4 className="font-medium text-gray-900 dark:text-gray-100">{title}</h4>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
