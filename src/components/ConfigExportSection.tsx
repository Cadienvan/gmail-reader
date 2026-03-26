import { useState } from 'react';
import { Download, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { configExportService } from '../services/configExportService';

export function ConfigExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const json = await configExportService.exportAllConfig();
      const date = new Date().toISOString().split('T')[0];
      configExportService.downloadJsonFile(json, `gmail-reader-config-export-${date}.json`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export configuration');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
        <Download size={20} />
        Export All Configuration
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Download all your settings, rules, filters, AI configuration, and flash cards as a single JSON file.
      </p>

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          This file contains sensitive data including API keys and OAuth credentials. Keep it secure.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download size={16} />
            Export Configuration
          </>
        )}
      </button>
    </div>
  );
}
