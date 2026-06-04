import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, RefreshCw, Database, AlertTriangle, X } from 'lucide-react';
import { emailCacheService } from '../services/emailCacheService';
import { dbStorageService } from '../services/dbStorageService';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { environmentConfigService } from '../services/environmentConfigService';
import { Button, IconButton, Callout, Card } from './ui';

interface StorageCategory {
  id: string;
  name: string;
  description: string;
  type: 'localStorage' | 'indexedDB';
  size: string;
  itemCount: number;
  lastUpdated: Date | null;
  canClear: boolean;
  warningMessage?: string;
}

interface StorageManagementPanelProps {
  className?: string;
}

export const StorageManagementPanel: React.FC<StorageManagementPanelProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [storageCategories, setStorageCategories] = useState<StorageCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearingCategory, setClearingCategory] = useState<string | null>(null);
  const [totalLocalStorageSize, setTotalLocalStorageSize] = useState('0 KB');

  useEffect(() => {
    if (isOpen) {
      loadStorageInfo();
    }
  }, [isOpen]);

  const calculateLocalStorageSize = (keys: string[]): string => {
    try {
      let totalBytes = 0;
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          totalBytes += new Blob([item]).size;
        }
      });
      return formatBytes(totalBytes);
    } catch (error) {
      return 'Unknown';
    }
  };

  const getLocalStorageKeys = (pattern?: RegExp): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (!pattern || pattern.test(key))) {
        keys.push(key);
      }
    }
    return keys;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const estimateObjectSize = (obj: any): number => {
    try {
      const jsonString = JSON.stringify(obj);
      return new Blob([jsonString]).size;
    } catch (error) {
      // Fallback estimation for objects that can't be stringified
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return value.toISOString();
        if (value === undefined) return null;
        return value;
      }).length * 2; // Rough estimate for UTF-16
    }
  };

  const estimateArraySize = (array: any[]): number => {
    return array.reduce((total, item) => total + estimateObjectSize(item), 0);
  };

  const loadStorageInfo = async () => {
    setIsLoading(true);
    try {
      const categories: StorageCategory[] = [];

      // Email Cache (localStorage)
      const emailCacheKeys = getLocalStorageKeys(/^gmail-email-cache/);
      const emailMetadataKeys = getLocalStorageKeys(/^gmail-cache-metadata/);
      const allEmailKeys = [...emailCacheKeys, ...emailMetadataKeys];
      const emailCacheStats = emailCacheService.getCacheStats();

      categories.push({
        id: 'email-cache',
        name: 'Email Cache',
        description: 'Cached emails and metadata for faster loading',
        type: 'localStorage',
        size: calculateLocalStorageSize(allEmailKeys),
        itemCount: emailCacheStats.totalEmails,
        lastUpdated: emailCacheStats.lastFetch,
        canClear: true,
        warningMessage: 'Clearing will reload emails from Gmail on next fetch'
      });

      // Gmail Authentication (localStorage)
      const authKeys = getLocalStorageKeys(/^gmail_(access_token|refresh_token|token_expiry|client_id|client_secret)$/);
      categories.push({
        id: 'gmail-auth',
        name: 'Gmail Authentication',
        description: 'Gmail OAuth tokens and credentials',
        type: 'localStorage',
        size: calculateLocalStorageSize(authKeys),
        itemCount: authKeys.length,
        lastUpdated: authKeys.length > 0 ? new Date() : null,
        canClear: true,
        warningMessage: 'You will need to re-authenticate with Gmail after clearing'
      });

      // Environment Configuration (localStorage)
      const envKeys = getLocalStorageKeys(/^environment-configuration$/);
      categories.push({
        id: 'environment-config',
        name: 'Environment Configuration',
        description: 'API URLs and OAuth settings',
        type: 'localStorage',
        size: calculateLocalStorageSize(envKeys),
        itemCount: envKeys.length,
        lastUpdated: envKeys.length > 0 ? new Date() : null,
        canClear: true,
        warningMessage: 'You will need to reconfigure the application after clearing'
      });

      // Ollama Configuration (localStorage)
      const ollamaKeys = getLocalStorageKeys(/^ollama-(model|prompt)-configuration$/);
      categories.push({
        id: 'ollama-config',
        name: 'Ollama Configuration',
        description: 'AI model and prompt settings',
        type: 'localStorage',
        size: calculateLocalStorageSize(ollamaKeys),
        itemCount: ollamaKeys.length,
        lastUpdated: ollamaKeys.length > 0 ? new Date() : null,
        canClear: true,
        warningMessage: 'AI settings will reset to defaults'
      });

      // Flash Cards (IndexedDB)
      try {
        const flashCards = await dbStorageService.getAllFlashCards();
        const tags = await dbStorageService.getAllTags();
        const flashCardsSize = estimateArraySize(flashCards);
        const tagsSize = estimateArraySize(tags);
        const totalSize = flashCardsSize + tagsSize;

        categories.push({
          id: 'flashcards',
          name: 'Flash Cards',
          description: 'Saved flash cards and tags',
          type: 'indexedDB',
          size: formatBytes(totalSize),
          itemCount: flashCards.length,
          lastUpdated: flashCards.length > 0 ? new Date() : null,
          canClear: true,
          warningMessage: `Will delete ${flashCards.length} flash cards and ${tags.length} tags`
        });
      } catch (error) {
        categories.push({
          id: 'flashcards',
          name: 'Flash Cards',
          description: 'Saved flash cards and tags',
          type: 'indexedDB',
          size: 'Error',
          itemCount: 0,
          lastUpdated: null,
          canClear: true,
          warningMessage: 'Database may be corrupted'
        });
      }

      // Tab Summaries (IndexedDB)
      try {
        const tabs = await tabSummaryStorage.getAllTabs();
        const tabsSize = estimateArraySize(tabs);

        categories.push({
          id: 'tab-summaries',
          name: 'Link Summaries',
          description: 'Cached link content and summaries',
          type: 'indexedDB',
          size: formatBytes(tabsSize),
          itemCount: tabs.length,
          lastUpdated: tabs.length > 0 ? new Date(Math.max(...tabs.map(t => t.lastOpened))) : null,
          canClear: true,
          warningMessage: `Will delete ${tabs.length} cached link summaries`
        });
      } catch (error) {
        categories.push({
          id: 'tab-summaries',
          name: 'Link Summaries',
          description: 'Cached link content and summaries',
          type: 'indexedDB',
          size: 'Error',
          itemCount: 0,
          lastUpdated: null,
          canClear: true,
          warningMessage: 'Database may be corrupted'
        });
      }

      setStorageCategories(categories);

      // Calculate total localStorage size
      const allLocalStorageKeys = getLocalStorageKeys();
      setTotalLocalStorageSize(calculateLocalStorageSize(allLocalStorageKeys));

    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to clear this storage category? This action cannot be undone.')) {
      return;
    }

    setClearingCategory(categoryId);
    try {
      switch (categoryId) {
        case 'email-cache':
          emailCacheService.forceRefresh();
          break;

        case 'gmail-auth':
          localStorage.removeItem('gmail_access_token');
          localStorage.removeItem('gmail_refresh_token');
          localStorage.removeItem('gmail_token_expiry');
          localStorage.removeItem('gmail_client_id');
          localStorage.removeItem('gmail_client_secret');
          break;

        case 'environment-config':
          environmentConfigService.resetToDefaults();
          break;

        case 'ollama-config':
          localStorage.removeItem('ollama-model-configuration');
          localStorage.removeItem('ollama-prompt-configuration');
          break;

        case 'flashcards':
          // Clear all flash cards and tags
          const flashCards = await dbStorageService.getAllFlashCards();
          const tags = await dbStorageService.getAllTags();

          for (const card of flashCards) {
            if (card.id) {
              await dbStorageService.deleteFlashCard(card.id);
            }
          }

          for (const tag of tags) {
            if (tag.id) {
              await dbStorageService.deleteTag(tag.id);
            }
          }
          break;

        case 'tab-summaries':
          const tabs = await tabSummaryStorage.getAllTabs();
          for (const tab of tabs) {
            await tabSummaryStorage.deleteTab(tab.url);
          }
          break;

        default:
          throw new Error(`Unknown category: ${categoryId}`);
      }

      // Reload storage info
      await loadStorageInfo();

    } catch (error) {
      console.error(`Failed to clear category ${categoryId}:`, error);
      alert(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearingCategory(null);
    }
  };

  const clearAllStorage = async () => {
    if (!confirm('Are you sure you want to clear ALL storage? This will log you out and reset all settings. This action cannot be undone.')) {
      return;
    }

    setClearingCategory('all');
    try {
      // Clear localStorage
      localStorage.clear();

      // Clear IndexedDB databases
      try {
        await new Promise((resolve, reject) => {
          const deleteDB1 = indexedDB.deleteDatabase('gmail-reader-db');
          deleteDB1.onsuccess = () => resolve(undefined);
          deleteDB1.onerror = () => reject(deleteDB1.error);
        });
      } catch (error) {
        console.error('Failed to delete gmail-reader-db:', error);
      }

      try {
        await new Promise((resolve, reject) => {
          const deleteDB2 = indexedDB.deleteDatabase('gmail-reader-tabs-db');
          deleteDB2.onsuccess = () => resolve(undefined);
          deleteDB2.onerror = () => reject(deleteDB2.error);
        });
      } catch (error) {
        console.error('Failed to delete gmail-reader-tabs-db:', error);
      }

      alert('All storage cleared successfully. The page will reload.');
      window.location.reload();

    } catch (error) {
      console.error('Failed to clear all storage:', error);
      alert(`Failed to clear all storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearingCategory(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<HardDrive className="w-4 h-4" />}
        onClick={() => setIsOpen(!isOpen)}
      >
        Storage
      </Button>

      {isOpen && (
        <div className="absolute top-10 right-0 z-50 w-96 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Storage Management</h3>
            <div className="flex gap-1">
              <IconButton
                label="Refresh"
                onClick={loadStorageInfo}
                disabled={isLoading}
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </IconButton>
              <IconButton
                label="Close"
                onClick={() => setIsOpen(false)}
                size="sm"
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Total Storage Info */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <Callout variant="info" icon={<Database className="w-4 h-4" />}>
                <p className="font-medium">Total localStorage: {totalLocalStorageSize}</p>
                <p className="text-xs mt-1">
                  IndexedDB sizes are estimated based on data content and may vary from actual disk usage
                </p>
              </Callout>
            </div>

            {isLoading ? (
              <div className="p-4 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-gray-600 dark:text-gray-400">Loading storage information...</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {storageCategories.map((category) => (
                  <Card key={category.id} padding="sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{category.name}</h4>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            category.type === 'localStorage'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {category.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{category.description}</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={
                          clearingCategory === category.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                        }
                        onClick={() => clearCategory(category.id)}
                        disabled={!category.canClear || clearingCategory === category.id}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Size:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{category.size}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Items:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{category.itemCount}</span>
                      </div>
                    </div>

                    {category.lastUpdated && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Last updated: {category.lastUpdated.toLocaleString()}
                      </div>
                    )}

                    {category.warningMessage && (
                      <div className="mt-2">
                        <Callout variant="warning" icon={<AlertTriangle className="w-4 h-4" />}>
                          {category.warningMessage}
                        </Callout>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Clear All Button */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Callout variant="danger">
                <Button
                  variant="danger"
                  fullWidth
                  leftIcon={
                    clearingCategory === 'all'
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                  }
                  onClick={clearAllStorage}
                  disabled={clearingCategory === 'all'}
                >
                  {clearingCategory === 'all' ? 'Clearing All...' : 'Clear All Storage'}
                </Button>
                <p className="text-xs mt-2 text-center">
                  This will clear everything and reload the page
                </p>
              </Callout>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
