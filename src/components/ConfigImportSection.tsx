import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { configExportService } from '../services/configExportService';
import type { ConfigExportSummary, ConfigImportResult } from '../types/configExport';
import { ConfigImportPreview } from './ConfigImportPreview';
import { Callout, Card } from './ui';

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
    <Card padding="md">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <Upload size={20} />
        Import Configuration
      </h3>

      {importResult ? (
        <Callout
          variant={importResult.success ? 'success' : 'danger'}
          icon={importResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        >
          <span className="font-medium">
            {importResult.success ? 'Configuration imported! Reloading...' : 'Import failed'}
          </span>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 text-xs space-y-1">
              {importResult.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </Callout>
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
            <Callout variant="danger" icon={<AlertTriangle size={16} />} className="mb-3">
              <span className="font-medium">Invalid file</span>
              <ul className="text-xs space-y-1 mt-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </Callout>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer text-gray-600 dark:text-gray-400"
          >
            <Upload size={16} />
            Select JSON file to import
          </label>
        </>
      )}
    </Card>
  );
}
