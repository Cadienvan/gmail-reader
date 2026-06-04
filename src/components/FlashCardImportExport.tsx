import React, { useState } from 'react';
import { Download, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { flashCardService } from '../services/flashCardService';
import { Button, Callout, Modal } from './ui';

interface FlashCardImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const FlashCardImportExport: React.FC<FlashCardImportExportProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    errors: string[];
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const jsonData = await flashCardService.exportFlashCards();

      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flashcards-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export flash cards');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const result = await flashCardService.importFlashCards(text);
      setImportResult(result);

      if (result.success && onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      setImportResult({
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Failed to import flash cards']
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleClose = () => {
    setImportResult(null);
    setExportError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import/Export Flash Cards"
      size="sm"
      footer={
        <Button variant="secondary" size="sm" onClick={handleClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Export Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Download size={20} />
            Export Flash Cards
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export all your flash cards and tags to a JSON file for backup or sharing.
          </p>

          {exportError && (
            <Callout variant="danger" icon={<AlertCircle size={16} />} className="mb-4">
              {exportError}
            </Callout>
          )}

          <Button
            variant="primary"
            fullWidth
            leftIcon={<FileText size={16} />}
            loading={isExporting}
            onClick={handleExport}
          >
            {isExporting ? 'Exporting...' : 'Export to JSON'}
          </Button>
        </div>

        {/* Import Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Upload size={20} />
            Import Flash Cards
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Import flash cards from a previously exported JSON file. This will add to your existing cards.
          </p>

          {importResult && (
            <Callout
              variant={importResult.success ? 'success' : 'danger'}
              icon={importResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              className="mb-4"
            >
              <span className="font-medium">
                {importResult.success
                  ? `Successfully imported ${importResult.imported} flash cards`
                  : 'Import failed'
                }
              </span>

              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-1">Issues:</div>
                  <ul className="text-xs space-y-1">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index} className="truncate">• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>
                        ... and {importResult.errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Callout>
          )}

          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
              id="flashcard-import"
            />
            <label
              htmlFor="flashcard-import"
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer text-gray-700 dark:text-gray-300 ${
                isImporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-300"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Select JSON file to import
                </>
              )}
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
