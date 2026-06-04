import React, { useState, useEffect } from 'react';
import { ExternalLink, Trash2, RefreshCw, AlertCircle, FileText, Link, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { IconButton, Callout, Modal } from './ui';

interface SummarizedTab {
  url: string;
  title?: string;
  summary: string;
  lastOpened: number;
}

interface TabSummariesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TabSummariesModal: React.FC<TabSummariesModalProps> = ({ isOpen, onClose }) => {
  const [tabs, setTabs] = useState<SummarizedTab[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  const loadTabs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allTabs = await tabSummaryStorage.getAllTabs();
      const withSummaries = allTabs
        .filter(
          tab =>
            tab.summaryReady &&
            tab.summary &&
            tab.summary !== 'Email saved for later review' &&
            tab.summary !== 'Link content saved for later review'
        )
        .map(tab => ({
          url: tab.url,
          title: tab.title,
          summary: tab.summary!,
          lastOpened: tab.lastOpened,
        }))
        .sort((a, b) => b.lastOpened - a.lastOpened);
      setTabs(withSummaries);
    } catch (err) {
      console.error('Failed to load tab summaries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summaries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (url: string) => {
    if (!confirm('Delete this summary?')) return;
    try {
      await tabSummaryStorage.deleteTab(url);
      setTabs(prev => prev.filter(t => t.url !== url));
    } catch (err) {
      console.error('Failed to delete tab:', err);
      setError('Failed to delete summary');
    }
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    const diffDays = Math.floor((Date.now() - ts) / 86400000);
    if (diffDays === 0) return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getTabIcon = (url: string) => {
    if (url.startsWith('email:')) return <Mail className="w-4 h-4 text-blue-500 shrink-0" />;
    if (url.startsWith('paste:')) return <FileText className="w-4 h-4 text-purple-500 shrink-0" />;
    return <Link className="w-4 h-4 text-green-500 shrink-0" />;
  };

  const getTabLabel = (tab: SummarizedTab) => {
    if (tab.title) return tab.title;
    if (tab.url.startsWith('email:')) return 'Email';
    if (tab.url.startsWith('paste:')) return 'Pasted text';
    try { return new URL(tab.url).hostname; } catch { return tab.url; }
  };

  useEffect(() => {
    if (isOpen) loadTabs();
  }, [isOpen]);

  const headerActions = (
    <IconButton
      label="Refresh"
      variant="ghost"
      onClick={loadTabs}
      disabled={isLoading}
    >
      <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
    </IconButton>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tab Summaries</div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {tabs.length} previously summarised {tabs.length === 1 ? 'tab' : 'tabs'}
          </p>
        </div>
      }
      headerActions={headerActions}
      size="md"
    >
      <div className="space-y-3">
        {error && (
          <Callout variant="danger" icon={<AlertCircle className="w-4 h-4 shrink-0" />}>
            {error}
          </Callout>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            Loading summaries…
          </div>
        ) : tabs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-200 dark:text-gray-700" />
            <p className="text-gray-500 dark:text-gray-400">No summaries yet. Open emails and let the AI summarise their links.</p>
          </div>
        ) : (
          tabs.map(tab => (
            <div
              key={tab.url}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {getTabIcon(tab.url)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                        {getTabLabel(tab)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(tab.lastOpened)}</span>
                    </div>

                    <div className={`prose prose-sm max-w-none mt-1 text-gray-700 dark:text-gray-200 ${expandedUrl === tab.url ? '' : 'line-clamp-3'}`}>
                      <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                        {tab.summary.includes('</think>')
                          ? tab.summary.split('</think>')[1]
                          : tab.summary}
                      </ReactMarkdown>
                    </div>

                    {(tab.summary.split('\n').length > 4 || tab.summary.length > 300) && (
                      <button
                        onClick={() => setExpandedUrl(expandedUrl === tab.url ? null : tab.url)}
                        className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {expandedUrl === tab.url ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {tab.url.startsWith('http') && (
                    <IconButton
                      label="Open link"
                      variant="ghost"
                      onClick={() => window.open(tab.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </IconButton>
                  )}
                  <IconButton
                    label="Delete summary"
                    variant="danger"
                    onClick={() => handleDelete(tab.url)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
