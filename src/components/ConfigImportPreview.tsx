import { FileUp } from 'lucide-react';
import type { ConfigExportSummary } from '../types/configExport';
import { Button, Callout } from './ui';

interface Props {
  summary: ConfigExportSummary;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function ConfigImportPreview({ summary, onConfirm, onCancel, isImporting }: Props) {
  const dateObj = new Date(summary.exportedAt);
  const date = isNaN(dateObj.getTime())
    ? 'Unknown date'
    : dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">Exported:</span> {date}&nbsp;&nbsp;
        <span className="font-medium">Version:</span> {summary.version}
      </div>

      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
        {summary.sections.filter((s) => s.present).map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            {s.name} — {s.count}
          </li>
        ))}
      </ul>

      <Callout variant="warning">
        ⚠ This will replace ALL your current configuration. This cannot be undone.
      </Callout>

      <div className="flex gap-2">
        <Button
          onClick={onCancel}
          disabled={isImporting}
          variant="secondary"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isImporting}
          loading={isImporting}
          variant="primary"
          leftIcon={<FileUp size={16} />}
          className="flex-1"
        >
          {isImporting ? 'Importing...' : 'Import & Restart'}
        </Button>
      </div>
    </div>
  );
}
