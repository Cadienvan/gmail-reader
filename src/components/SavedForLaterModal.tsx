import React, { useState, useEffect } from 'react';
import { X, Bookmark, Calendar, ExternalLink, Trash2, RefreshCw, AlertCircle, Download, Play, Loader2 } from 'lucide-react';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { ollamaService } from '../services/ollamaService';
import { linkService } from '../services/linkService';
import type { LinkSummary } from '../types';

interface SavedForLaterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SavedItem extends LinkSummary {
  title?: string;
  lastOpened: number;
  content?: string;
  savedForLater?: boolean;
}

export const SavedForLaterModal: React.FC<SavedForLaterModalProps> = ({ isOpen, onClose }) => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingSummaries, setGeneratingSummaries] = useState<Set<string>>(new Set());

  const loadSavedItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tabs = await tabSummaryStorage.getAllTabs();
      
      // Filter for saved for later items (items without summaries or with savedForLater flag)
      const savedForLaterItems = tabs
        .filter(tab => 
          !tab.summary || // No summary means it was saved for later
          tab.summary === 'Email saved for later review' || // Email saved for later
          tab.summary === 'Link content saved for later review' // Link saved for later
        )
        .map(tab => ({
          url: tab.url,
          summary: tab.summary || '',
          loading: false,
          title: tab.title,
          lastOpened: tab.lastOpened,
          content: tab.content,
          savedForLater: true
        }))
        .sort((a, b) => b.lastOpened - a.lastOpened); // Sort by most recent first
      
      setSavedItems(savedForLaterItems);
    } catch (error) {
      console.error('Failed to load saved items:', error);
      setError(error instanceof Error ? error.message : 'Failed to load saved items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (url: string) => {
    if (!confirm('Are you sure you want to delete this saved item?')) {
      return;
    }

    try {
      await tabSummaryStorage.deleteTab(url);
      setSavedItems(prev => prev.filter(item => item.url !== url));
    } catch (error) {
      console.error('Failed to delete saved item:', error);
      setError('Failed to delete item');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete ALL ${savedItems.length} saved items? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Delete all saved items one by one
      for (const item of savedItems) {
        await tabSummaryStorage.deleteTab(item.url);
      }
      setSavedItems([]);
    } catch (error) {
      console.error('Failed to delete all saved items:', error);
      setError('Failed to delete some items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLink = (url: string) => {
    // Only open external links, not internal email references
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank');
    }
  };

  const handleStartSummary = async (item: SavedItem) => {
    if (generatingSummaries.has(item.url)) return;

    setGeneratingSummaries(prev => new Set(prev).add(item.url));
    setError(null);

    try {
      let summary: string;

      if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
        // For URLs, fetch content and generate summary
        const { content } = await linkService.fetchLinkContent(item.url);
        summary = await ollamaService.generateSummary(content);
      } else if (item.url.startsWith('email:')) {
        // For emails, use stored content to generate summary
        summary = await ollamaService.generateSummary(item.content || 'No content available');
      } else {
        // For other content (pasted text), generate summary directly
        summary = await ollamaService.generateSummary(item.content || 'No content available');
      }

      // Update the item with the generated summary
      const updatedItem: SavedItem = {
        ...item,
        summary,
        loading: false,
        savedForLater: false
      };

      // Save back to storage with summary
      await tabSummaryStorage.saveLinkSummary(
        item.url,
        updatedItem,
        item.content,
        item.title
      );

      // Remove from saved items list since it now has a summary
      setSavedItems(prev => prev.filter(savedItem => savedItem.url !== item.url));

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white bg-green-600';
      notification.textContent = 'Summary generated successfully! Item moved to email tabs.';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);

    } catch (error) {
      console.error('Failed to generate summary:', error);
      setError(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingSummaries(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.url);
        return newSet;
      });
    }
  };

  const handleExportItems = () => {
    const exportData = savedItems.map(item => {
      let type: string;
      let content: string;

      if (item.url.startsWith('email:')) {
        type = 'text';
        content = item.content || 'Saved Email';
      } else if (item.url.startsWith('paste:')) {
        type = 'text';
        content = item.content || 'Pasted Text';
      } else {
        type = 'link';
        content = item.url;
      }

      return {
        type,
        content
      };
    });

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved_items.json';
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getItemType = (url: string) => {
    if (url.startsWith('email:')) {
      return 'Email';
    } else if (url.startsWith('paste:')) {
      return 'Pasted Text';
    } else {
      return 'Link';
    }
  };

  const getItemTitle = (item: SavedItem) => {
    if (item.title) {
      return item.title;
    }
    
    if (item.url.startsWith('email:')) {
      return 'Saved Email';
    } else if (item.url.startsWith('paste:')) {
      return 'Pasted Text';
    } else {
      try {
        const url = new URL(item.url);
        return url.hostname;
      } catch {
        return 'Saved Link';
      }
    }
  };

  const getItemDescription = (item: SavedItem) => {
    if (item.content) {
      // Show first 150 characters of content
      return item.content.substring(0, 150) + (item.content.length > 150 ? '...' : '');
    }
    return 'Saved for later review';
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedItems();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Saved for Later</h2>
              <p className="text-sm text-gray-600">
                Content you've saved for later review ({savedItems.length} items)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSavedItems}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh saved items"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Loading saved items...</p>
            </div>
          ) : savedItems.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved items</h3>
              <p className="text-gray-600">
                Items you save for later will appear here. Use the "Save for later" mode in email modals to save content without generating summaries.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedItems.map((item) => (
                <div
                  key={item.url}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {getItemType(item.url)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.lastOpened)}
                        </div>
                      </div>
                      
                      <h3 className="font-medium text-gray-900 mb-1 truncate">
                        {getItemTitle(item)}
                      </h3>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {getItemDescription(item)}
                      </p>
                      
                      {item.url.startsWith('http') && (
                        <p className="text-xs text-gray-400 truncate">
                          {item.url}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {/* Start Summary Button */}
                      <button
                        onClick={() => handleStartSummary(item)}
                        disabled={generatingSummaries.has(item.url)}
                        className="p-2 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Generate summary and move to email tabs"
                      >
                        {generatingSummaries.has(item.url) ? (
                          <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      
                      {(item.url.startsWith('http://') || item.url.startsWith('https://')) && (
                        <button
                          onClick={() => handleOpenLink(item.url)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item.url)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete saved item"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Tip: Enable "Save for later mode" in Configuration to save content without generating summaries
            </p>
            <div className="flex items-center gap-2">
              {savedItems.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="px-3 py-1 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  title="Delete all saved items"
                >
                  <Trash2 className="w-4 h-4 mr-1 -ml-1" />
                  Delete All
                </button>
              )}
              <button
                onClick={handleExportItems}
                className="px-3 py-1 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Export saved items"
              >
                <Download className="w-4 h-4 mr-1 -ml-1" />
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
