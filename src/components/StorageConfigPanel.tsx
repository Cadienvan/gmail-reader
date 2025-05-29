import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { emailCacheService } from '../services/emailCacheService';
import { dbStorageService } from '../services/dbStorageService';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { environmentConfigService } from '../services/environmentConfigService';

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

interface StorageConfigPanelProps {
  className?: string;
}

export const StorageConfigPanel: React.FC<StorageConfigPanelProps> = ({ className = '' }) => {
  const [storageCategories, setStorageCategories] = useState<StorageCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearingCategory, setClearingCategory] = useState<string | null>(null);
  const [totalLocalStorageSize, setTotalLocalStorageSize] = useState('0 KB');

  useEffect(() => {
    loadStorageInfo();
  }, []);

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
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return value.toISOString();
        if (value === undefined) return null;
        return value;
      }).length * 2;
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
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Storage Management</h3>
            <p className="text-sm text-gray-600 mt-1">
              View and manage application data storage
            </p>
          </div>
          <button
            onClick={loadStorageInfo}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            title="Refresh storage information"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Total Storage Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">Total localStorage: {totalLocalStorageSize}</span>
          </div>
          <p className="text-sm text-blue-700">
            IndexedDB sizes are estimated based on data content and may vary from actual disk usage
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading storage information...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {storageCategories.map((category) => (
              <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900">{category.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded ${
                        category.type === 'localStorage' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {category.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                  </div>
                  <button
                    onClick={() => clearCategory(category.id)}
                    disabled={!category.canClear || clearingCategory === category.id}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {clearingCategory === category.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-2 font-medium">{category.size}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Items:</span>
                    <span className="ml-2 font-medium">{category.itemCount}</span>
                  </div>
                </div>

                {category.lastUpdated && (
                  <div className="text-xs text-gray-500 mb-3">
                    Last updated: {category.lastUpdated.toLocaleString()}
                  </div>
                )}

                {category.warningMessage && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-700">{category.warningMessage}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Clear All Button */}
        <div className="pt-6 border-t">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">Danger Zone</h4>
            <p className="text-sm text-red-700 mb-4">
              Clear all application data. This will log you out and reset all settings.
            </p>
            <button
              onClick={clearAllStorage}
              disabled={clearingCategory === 'all'}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingCategory === 'all' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Clearing All...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear All Storage
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
