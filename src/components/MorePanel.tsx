import { ConfigExportSection } from './ConfigExportSection';
import { ConfigImportSection } from './ConfigImportSection';

export function MorePanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Import & Export</h2>
        <p className="text-sm text-gray-600 mt-1">
          Export all your configuration to a JSON file, or restore from a previously exported file.
        </p>
      </div>
      <div className="space-y-4">
        <ConfigExportSection />
        <ConfigImportSection />
      </div>
    </div>
  );
}
