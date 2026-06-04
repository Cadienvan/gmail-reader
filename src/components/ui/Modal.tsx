import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-7xl',
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Header title. Omit to render a header with only the close button. */
  title?: React.ReactNode;
  /** Extra controls rendered in the header, left of the close button. */
  headerActions?: React.ReactNode;
  size?: ModalSize;
  /** Footer content (typically action buttons), rendered right-aligned. */
  footer?: React.ReactNode;
  /** Close when clicking the backdrop. Default true. */
  closeOnOverlayClick?: boolean;
  /** Extra classes for the body wrapper. */
  bodyClassName?: string;
  children?: React.ReactNode;
}

/**
 * Standard modal shell: backdrop + centered card with header (title + close),
 * scrollable body and optional footer. Closes on Escape and backdrop click.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  headerActions,
  size = 'md',
  footer,
  closeOnOverlayClick = true,
  bodyClassName,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={cn(
          'bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col',
          'border border-transparent dark:border-gray-700',
          SIZES[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
          {typeof title === 'string' ? (
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          ) : (
            <div className="min-w-0">{title}</div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions}
            <IconButton label="Close" onClick={onClose}>
              <X className="w-6 h-6" />
            </IconButton>
          </div>
        </div>

        <div className={cn('flex-1 overflow-y-auto p-6 text-gray-900 dark:text-gray-100', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
