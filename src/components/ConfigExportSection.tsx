import { useState } from 'react';
import { Download, AlertCircle } from 'lucide-react';
import { configExportService } from '../services/configExportService';
import { Button, Callout, Card } from './ui';

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
    <Card padding="md">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <Download size={20} />
        Export All Configuration
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Download all your settings, rules, filters, AI configuration, and flash cards as a single JSON file.
      </p>

      <Callout variant="warning" className="mb-4">
        This file contains sensitive data including API keys and OAuth credentials. Keep it secure.
      </Callout>

      {error && (
        <Callout variant="danger" icon={<AlertCircle size={16} />} className="mb-4">
          {error}
        </Callout>
      )}

      <Button
        onClick={handleExport}
        disabled={isExporting}
        loading={isExporting}
        variant="success"
        fullWidth
        leftIcon={<Download size={16} />}
      >
        {isExporting ? 'Exporting...' : 'Export Configuration'}
      </Button>
    </Card>
  );
}
