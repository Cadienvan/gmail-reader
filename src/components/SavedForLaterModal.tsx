import React, { useState, useEffect } from 'react';
import { Bookmark, Calendar, ExternalLink, Trash2, RefreshCw, AlertCircle, Download, Play, Loader2 } from 'lucide-react';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { ollamaService } from '../services/ollamaService';
import { linkService } from '../services/linkService';
import type { LinkSummary } from '../types';
import { Button, IconButton, Callout, Modal } from './ui';

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

  const headerActions = (
    <IconButton
      label="Refresh saved items"
      onClick={loadSavedItems}
      disabled={isLoading}
      variant="ghost"
    >
      <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
    </IconButton>
  );

  const footer = (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 mr-auto">
        Tip: Enable "Save for later mode" in Configuration to save content without generating summaries
      </p>
      {savedItems.length > 0 && (
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 className="w-4 h-4" />}
          onClick={handleDeleteAll}
        >
          Delete All
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        leftIcon={<Download className="w-4 h-4" />}
        onClick={handleExportItems}
      >
        Export as JSON
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-blue-600" />
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Saved for Later</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Content you've saved for later review ({savedItems.length} items)
              </p>
            </div>
          </div>
        </div>
      }
      headerActions={headerActions}
      size="lg"
      footer={footer}
    >
      {error && (
        <Callout variant="danger" icon={<AlertCircle className="w-4 h-4" />} className="mb-4">
          {error}
        </Callout>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-600 dark:text-gray-400">Loading saved items...</p>
        </div>
      ) : savedItems.length === 0 ? (
        <div className="text-center py-12">
          <Bookmark className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No saved items</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Items you save for later will appear here. Use the "Save for later" mode in email modals to save content without generating summaries.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedItems.map((item) => (
            <div
              key={item.url}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {getItemType(item.url)}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.lastOpened)}
                    </div>
                  </div>

                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
                    {getItemTitle(item)}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {getItemDescription(item)}
                  </p>

                  {item.url.startsWith('http') && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {item.url}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Start Summary Button */}
                  <IconButton
                    label="Generate summary and move to email tabs"
                    variant="success"
                    onClick={() => handleStartSummary(item)}
                    disabled={generatingSummaries.has(item.url)}
                  >
                    {generatingSummaries.has(item.url) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </IconButton>

                  {(item.url.startsWith('http://') || item.url.startsWith('https://')) && (
                    <IconButton
                      label="Open in new tab"
                      variant="ghost"
                      onClick={() => handleOpenLink(item.url)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </IconButton>
                  )}
                  <IconButton
                    label="Delete saved item"
                    variant="danger"
                    onClick={() => handleDeleteItem(item.url)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};
