import React from 'react';
import { cn } from './cn';
import { FIELD_BASE } from './Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Render with a monospace font (prompts, code, regex). */
  mono?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ mono = false, className, rows = 4, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(FIELD_BASE, 'resize-vertical', mono && 'font-mono text-sm', className)}
      {...rest}
    />
  )
);

Textarea.displayName = 'Textarea';
