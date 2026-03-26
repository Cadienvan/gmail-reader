import { FileUp, Loader2 } from 'lucide-react';
import type { ConfigExportSummary } from '../types/configExport';

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
      <div className="text-sm text-gray-600">
        <span className="font-medium">Exported:</span> {date}&nbsp;&nbsp;
        <span className="font-medium">Version:</span> {summary.version}
      </div>

      <ul className="text-sm text-gray-700 space-y-1">
        {summary.sections.filter((s) => s.present).map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            {s.name} — {s.count}
          </li>
        ))}
      </ul>

      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
        ⚠ This will replace ALL your current configuration. This cannot be undone.
      </p>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={isImporting}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isImporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isImporting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <FileUp size={16} />
              Import &amp; Restart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
