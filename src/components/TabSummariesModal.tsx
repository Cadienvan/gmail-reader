import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Trash2, RefreshCw, AlertCircle, FileText, Link, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { tabSummaryStorage } from '../services/tabSummaryStorage';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tab Summaries</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {tabs.length} previously summarised {tabs.length === 1 ? 'tab' : 'tabs'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTabs}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
              Loading summaries…
            </div>
          ) : tabs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500">No summaries yet. Open emails and let the AI summarise their links.</p>
            </div>
          ) : (
            tabs.map(tab => (
              <div
                key={tab.url}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {getTabIcon(tab.url)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm truncate">
                          {getTabLabel(tab)}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(tab.lastOpened)}</span>
                      </div>

                      <div className={`prose prose-sm max-w-none mt-1 ${expandedUrl === tab.url ? '' : 'line-clamp-3'}`}>
                        <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                          {tab.summary.includes('</think>')
                            ? tab.summary.split('</think>')[1]
                            : tab.summary}
                        </ReactMarkdown>
                      </div>

                      {(tab.summary.split('\n').length > 4 || tab.summary.length > 300) && (
                        <button
                          onClick={() => setExpandedUrl(expandedUrl === tab.url ? null : tab.url)}
                          className="mt-1 text-xs text-blue-600 hover:underline"
                        >
                          {expandedUrl === tab.url ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {tab.url.startsWith('http') && (
                      <button
                        onClick={() => window.open(tab.url, '_blank')}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Open link"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(tab.url)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete summary"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
