import React, { useState } from 'react';
import { Edit, Eye, Save, X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { Textarea } from './Textarea';
import { Input } from './Input';

export interface EditableFieldProps {
  /** Section title shown in the header. */
  label: string;
  /** Optional helper text under the title. */
  description?: React.ReactNode;
  /** Current persisted value. */
  value: string;
  /** Called with the new value when the user clicks Save. May be async. */
  onSave: (value: string) => void | Promise<void>;
  /** Use a single-line <input> instead of a <textarea>. Default false. */
  singleLine?: boolean;
  /** Monospace font for the editor and preview (prompts, regex, code). */
  mono?: boolean;
  /** Textarea height in rows while editing. Default 10. */
  rows?: number;
  placeholder?: string;
  /** Content shown (as a Callout-like tip) only while editing. */
  tip?: React.ReactNode;
  /** Text shown in the preview when the value is empty. */
  emptyText?: string;
  className?: string;
}

/**
 * The platform-wide editing primitive: a read-only preview with an "Edit"
 * toggle that reveals an editor with Save / Cancel. Manages its own draft and
 * editing state; commits to `onSave` only on Save, reverts on Cancel.
 */
export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  description,
  value,
  onSave,
  singleLine = false,
  mono = false,
  rows = 10,
  placeholder,
  tip,
  emptyText = 'Not set',
  className,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      console.error(`Failed to save "${label}":`, error);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = draft !== value;

  return (
    <div className={cn('border border-gray-200 dark:border-gray-700 rounded-lg p-6', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{label}</h4>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        {!editing && (
          <Button variant="soft" size="sm" leftIcon={<Edit size={16} />} onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {singleLine ? (
            <Input
              value={draft}
              mono={mono}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <Textarea
              value={draft}
              mono={mono}
              rows={rows}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          )}

          {tip && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              {tip}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" leftIcon={<X size={16} />} onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Save size={16} />}
              onClick={save}
              loading={saving}
              disabled={!hasChanges}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md border border-gray-200 dark:border-gray-700">
          {value ? (
            <pre
              className={cn(
                'whitespace-pre-wrap break-words max-h-48 overflow-y-auto text-gray-700 dark:text-gray-300',
                mono ? 'font-mono text-sm' : 'text-sm'
              )}
            >
              {value}
            </pre>
          ) : (
            <p className="text-sm italic text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Eye size={14} /> {emptyText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
