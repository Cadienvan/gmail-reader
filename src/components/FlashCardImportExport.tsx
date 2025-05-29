import React, { useState } from 'react';
import { Download, Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { flashCardService } from '../services/flashCardService';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Import/Export Flash Cards
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Export Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Download size={20} />
              Export Flash Cards
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Export all your flash cards and tags to a JSON file for backup or sharing.
            </p>
            
            {exportError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={16} />
                  <span className="text-sm">{exportError}</span>
                </div>
              </div>
            )}
            
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Export to JSON
                </>
              )}
            </button>
          </div>

          {/* Import Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Upload size={20} />
              Import Flash Cards
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Import flash cards from a previously exported JSON file. This will add to your existing cards.
            </p>
            
            {importResult && (
              <div className={`mb-4 p-3 border rounded-md ${
                importResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className={`flex items-center gap-2 ${
                  importResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {importResult.success ? (
                    <CheckCircle size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span className="text-sm font-medium">
                    {importResult.success 
                      ? `Successfully imported ${importResult.imported} flash cards`
                      : 'Import failed'
                    }
                  </span>
                </div>
                
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-gray-700 mb-1">Issues:</div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {importResult.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="truncate">• {error}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-gray-500">
                          ... and {importResult.errors.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
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
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors cursor-pointer ${
                  isImporting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
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

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
