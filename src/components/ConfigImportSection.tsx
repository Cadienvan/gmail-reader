import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { configExportService } from '../services/configExportService';
import type { ConfigExportSummary, ConfigImportResult } from '../types/configExport';
import { ConfigImportPreview } from './ConfigImportPreview';

export function ConfigImportSection() {
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConfigExportSummary | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ConfigImportResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { valid, summary, errors } = configExportService.validateExport(text);
      e.target.value = '';
      if (valid) {
        setRawJson(text);
        setPreview(summary);
        setValidationErrors([]);
      } else {
        setValidationErrors(errors);
        setPreview(null);
        setRawJson(null);
      }
    } catch (err) {
      setValidationErrors([`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      e.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!rawJson) return;
    setIsImporting(true);
    const result = await configExportService.importAllConfig(rawJson);
    setImportResult(result);
    setIsImporting(false);
    if (result.success) setTimeout(() => window.location.reload(), 1500);
  };

  const handleCancel = () => {
    setPreview(null);
    setRawJson(null);
    setValidationErrors([]);
    setImportResult(null);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
        <Upload size={20} />
        Import Configuration
      </h3>

      {importResult ? (
        <div
          className={`p-3 border rounded-md ${
            importResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm font-medium ${
              importResult.success ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {importResult.success ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {importResult.success
              ? 'Configuration imported! Reloading...'
              : 'Import failed'}
          </div>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 space-y-1">
              {importResult.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </div>
      ) : preview ? (
        <ConfigImportPreview
          summary={preview}
          onConfirm={handleImport}
          onCancel={handleCancel}
          isImporting={isImporting}
        />
      ) : (
        <>
          {validationErrors.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <AlertTriangle size={16} />
                <span className="text-sm font-medium">Invalid file</span>
              </div>
              <ul className="text-xs text-red-600 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
            id="config-import"
          />
          <label
            htmlFor="config-import"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer text-gray-600"
          >
            <Upload size={16} />
            Select JSON file to import
          </label>
        </>
      )}
    </div>
  );
}
