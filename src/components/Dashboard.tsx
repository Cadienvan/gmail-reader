import React, { useState, useEffect } from 'react';
import { Mail, BookOpen, AlertCircle, CheckCircle, Gamepad2, RefreshCw, ChevronLeft, ChevronRight, Download, Settings, Github, Bookmark, LucideDollarSign, FileText, Sparkles, StopCircle, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { ParsedEmail, ViewedEmail, FlashCard, ModelConfiguration, LinkSummary } from '../types';
import { gmailService } from '../services/gmailService';
import { ollamaService } from '../services/ollamaService';
import { emailLogService } from '../utils/emailLogService';
import { flashCardService } from '../services/flashCardService';
import { environmentConfigService } from '../services/environmentConfigService';
import { emailCacheService } from '../services/emailCacheService';
import { ollamaWarningService } from '../services/ollamaWarningService';
import { EmailModal } from './EmailModal';
import { EmailLogModal } from './EmailLogModal';
import { FlashCardsModal } from './FlashCardsModal';
import { FlashCardImportExport } from './FlashCardImportExport';
import { VoiceCommands } from './VoiceCommands';
import { ConfigurationModal } from './ConfigurationModal';
import { SavedForLaterModal } from './SavedForLaterModal';
import { TabSummariesModal } from './TabSummariesModal';
import { RulesDebugFloater } from './RulesDebugFloater';
import { gempestService } from '../services/gempestService';
import { newsletterRatingService } from '../services/newsletterRatingService';
import { Button, IconButton, Callout } from './ui';

// Singolo pollice su/giù con percentuale, colorato in base al segno della qualità.
const QualityThumb: React.FC<{ quality: number; title: string }> = ({ quality, title }) => {
  const isPositive = quality >= 50;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 shrink-0 text-xs font-medium ${
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {isPositive ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}
      {quality}%
    </span>
  );
};

// Mostra, accanto al titolo, l'orientamento storico verso il mittente con due badge:
// la qualità complessiva (all-time) e quella degli ultimi 30 giorni.
// Non mostra nulla finché non ci sono rating per il mittente.
const SenderSentimentBadge: React.FC<{ sender: string }> = ({ sender }) => {
  const stats = newsletterRatingService.getSenderStats(sender);
  if (stats.globalQuality < 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <QualityThumb
        quality={stats.globalQuality}
        title={`Storico complessivo: ${stats.globalQuality}% positivo (${stats.totalRatings} valutazioni)`}
      />
      {stats.last30Quality >= 0 && (
        <QualityThumb
          quality={stats.last30Quality}
          title={`Ultimi 30 giorni: ${stats.last30Quality}% positivo (${stats.ratingsLast30} valutazioni)`}
        />
      )}
    </span>
  );
};

export const Dashboard: React.FC = () => {
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [viewedEmails, setViewedEmails] = useState<ViewedEmail[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [currentModel, setCurrentModel] = useState<ModelConfiguration>(() => ollamaService.getModelConfiguration());

  // Pagination state
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [prevPageTokens, setPrevPageTokens] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showFlashCardGameModal, setShowFlashCardGameModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [showConfigurationModal, setShowConfigurationModal] = useState(false);
  const [showSavedForLaterModal, setShowSavedForLaterModal] = useState(false);
  const [showTabSummariesModal, setShowTabSummariesModal] = useState(false);
  const [showRulesDebugFloater, setShowRulesDebugFloater] = useState(true);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [allFlashCards, setAllFlashCards] = useState<FlashCard[]>([]);
  const [isLoadingFlashCards, setIsLoadingFlashCards] = useState(false);
  const [isGempestRunning, setIsGempestRunning] = useState(false);
  const [gempestStatus, setGempestStatus] = useState("");
  const [gempestSummaries, setGempestSummaries] = useState<Map<string, LinkSummary>>(new Map());
  const [isOllamaWarningDismissed, setIsOllamaWarningDismissed] = useState(() => ollamaWarningService.isWarningDismissed());

  useEffect(() => {
    checkOllamaStatus();
    loadViewedEmails();
  }, []);

  // Track model changes
  useEffect(() => {
    const checkModelChanges = () => {
      const newConfig = ollamaService.getModelConfiguration();
      if (JSON.stringify(newConfig) !== JSON.stringify(currentModel)) {
        setCurrentModel(newConfig);
      }
    };

    // Check every second for model changes (could be optimized with events)
    const interval = setInterval(checkModelChanges, 1000);

    return () => clearInterval(interval);
  }, [currentModel]);

  const checkOllamaStatus = async () => {
    setOllamaStatus('checking');
    const isAvailable = await ollamaService.isServiceAvailable();
    setOllamaStatus(isAvailable ? 'available' : 'unavailable');
  };

  const handleDismissOllamaWarning = () => {
    ollamaWarningService.dismissWarning();
    setIsOllamaWarningDismissed(true);
  };

  const loadViewedEmails = () => {
    const allEmails = emailLogService.getAllViewedEmails();
    setViewedEmails(allEmails);
  };

  const loadAllFlashCards = async () => {
    setIsLoadingFlashCards(true);
    try {
      // Load all flash cards for the game including their tags
      const cards = await flashCardService.getAllFlashCards();

      // Only open the game modal if we have cards
      if (cards.length > 0) {
        setAllFlashCards(cards);
        setShowFlashCardGameModal(true);
      } else {
        setError('No flash cards found. Create some flash cards first.');
      }
    } catch (error) {
      console.error('Failed to load flash cards:', error);
      setError('Failed to load flash cards for the game');
    } finally {
      setIsLoadingFlashCards(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!gmailService.isConfigured()) {
        setError('Gmail OAuth not configured. Please set up your Google OAuth credentials in the environment variables.');
        return;
      }

      const success = await gmailService.authenticateWithGoogle();
      if (success) {
        setIsAuthenticated(true);
        await loadEmails();
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmails = async () => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);

    try {
      await fetchEmails();
    } catch (error) {
      console.error('Failed to load emails:', error);
      handleRetry();
    }
  };

  const refreshEmails = async () => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);

    try {
      // Force clear the email cache to ensure fresh data
      console.log('Refresh emails: Starting cache clear...');
      emailCacheService.forceRefresh();
      console.log('Refresh emails: Email cache cleared - fetching fresh emails from Gmail');
      await fetchEmailsWithForceRefresh();
      console.log('Refresh emails: Successfully fetched fresh emails');
    } catch (error) {
      console.error('Failed to refresh emails:', error);
      handleRetry();
    }
  };

  const fetchEmails = async (token?: string): Promise<void> => {
    const result = await gmailService.getUnreadEmails(token);
    setEmails(result.emails);
    setNextPageToken(result.nextPageToken);
    setIsLoading(false);
    setIsRetrying(false);
    setRetryCount(0);
  };

  const fetchEmailsWithForceRefresh = async (token?: string): Promise<void> => {
    const result = await gmailService.getUnreadEmails(token, 50, true);
    setEmails(result.emails);
    setNextPageToken(result.nextPageToken);
    setIsLoading(false);
    setIsRetrying(false);
    setRetryCount(0);
  };

  const handleRetry = async () => {
    const maxRetries = 3;

    if (retryCount < maxRetries - 1) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setIsRetrying(true);
      setError(`Gmail error. Retry attempt ${newRetryCount}/${maxRetries}...`);

      // Add a small delay before retrying (increasing with each retry)
      const delayMs = 1000 * newRetryCount;
      await new Promise(resolve => setTimeout(resolve, delayMs));

      try {
        await fetchEmails();
      } catch (error) {
        console.error(`Retry ${newRetryCount} failed:`, error);
        handleRetry();
      }
    } else {
      setIsRetrying(false);
      setIsLoading(false);
      setError('Failed to load emails after multiple attempts. Please try refreshing manually.');
    }
  };

  const handleNextEmail = () => {
    if (currentEmailIndex < emails.length - 1) {
      setCurrentEmailIndex(currentEmailIndex + 1);
    }
  };

  const handlePrevEmail = () => {
    if (currentEmailIndex > 0) {
      setCurrentEmailIndex(currentEmailIndex - 1);
    }
  };

  const handleCloseModal = () => {
    setShowEmailModal(false);
    loadViewedEmails(); // Refresh viewed emails list
    // Force re-render to update sender ranks after potential scoring changes
    setEmails(prevEmails => [...prevEmails]);
  };

  const handleEmailMarkedAsRead = (emailId: string) => {
    // Update the email's read status in the local state
    setEmails(prevEmails =>
      prevEmails.map(email =>
        email.id === emailId ? { ...email, isRead: true } : email
      )
    );
    // Note: We don't refresh the email list here to avoid index shifts during traversal
    // The list will be refreshed when the modal is closed or when user explicitly refreshes
  };

  const handleEmailDeleted = (emailId: string) => {
    console.log(`[Dashboard] Email deleted: ${emailId}, updating email list and index`);

    // Remove the deleted email from the emails array
    setEmails(prevEmails => {
      const emailIndex = prevEmails.findIndex(email => email.id === emailId);
      const filteredEmails = prevEmails.filter(email => email.id !== emailId);

      console.log(`[Dashboard] Found email at index ${emailIndex}, filtered emails count: ${filteredEmails.length}`);

      // If this was the last email in the list, handle navigation
      if (filteredEmails.length === 0) {
        setShowEmailModal(false);
        // If no more emails in current page and we're not on page 1, go to previous page
        if (currentPage > 1) {
          handlePrevPage();
        }
        return filteredEmails;
      }

      // Calculate new index to maintain position as much as possible
      let newIndex = currentEmailIndex;

      // If we deleted an email before the current index, adjust the current index
      if (emailIndex < currentEmailIndex) {
        newIndex = currentEmailIndex - 1;
        console.log(`[Dashboard] Deleted email was before current, adjusting index from ${currentEmailIndex} to ${newIndex}`);
      }
      // If we deleted the email at the current index, stay at the same index
      // unless it was the last email in the list
      else if (emailIndex === currentEmailIndex && currentEmailIndex >= filteredEmails.length) {
        newIndex = Math.max(0, filteredEmails.length - 1);
        console.log(`[Dashboard] Deleted current email at end of list, adjusting index from ${currentEmailIndex} to ${newIndex}`);
      }
      else if (emailIndex === currentEmailIndex) {
        console.log(`[Dashboard] Deleted current email, staying at index ${currentEmailIndex} to view next email`);
      }

      // Update the current email index
      console.log(`[Dashboard] Setting new email index to ${newIndex}, new email will be: "${filteredEmails[newIndex]?.subject}"`);
      setCurrentEmailIndex(newIndex);

      return filteredEmails;
    });
  };

  const OllamaStatusIndicator = () => {
    switch (ollamaStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm px-2.5 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-100 dark:border-yellow-800 inline-flex">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span>Checking Ollama service...</span>
          </div>
        );
      case 'available':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-100 dark:border-green-800 inline-flex">
            <CheckCircle size={14} />
            <span>Ollama service ready</span>
          </div>
        );
      case 'unavailable':
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-100 dark:border-red-800 inline-flex">
            <AlertCircle size={14} />
            <span>Ollama service unavailable</span>
          </div>
        );
    }
  };

  // Pagination handlers
  const handleNextPage = async () => {
    if (!nextPageToken) return;

    setIsLoading(true);
    setError(null);

    try {
      // Save current page token to allow going back
      setPrevPageTokens(prev => [...prev, nextPageToken]);
      await fetchEmails(nextPageToken);
      setCurrentPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load next page of emails:', error);
      setError('Failed to load more emails');
      setIsLoading(false);
    }
  };

  const handlePrevPage = async () => {
    if (prevPageTokens.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get the last token from our history
      const lastToken = prevPageTokens[prevPageTokens.length - 2]; // Get the one before the last

      // Update the token history
      setPrevPageTokens(prev => prev.slice(0, -1));

      // Fetch with the previous token
      if (lastToken) {
        await fetchEmails(lastToken);
      } else {
        await fetchEmails(); // First page
      }

      setCurrentPage(prev => prev - 1);
    } catch (error) {
      console.error('Failed to load previous page of emails:', error);
      setError('Failed to load previous emails');
      setIsLoading(false);
    }
  };

  // Voice command callbacks
  const voiceCommandCallbacks = {
    onNext: () => {
      if (showEmailModal && emails.length > 0) {
        handleNextEmail();
      }
    },
    onPrevious: () => {
      if (showEmailModal && emails.length > 0) {
        handlePrevEmail();
      }
    },
    onShowLog: () => {
      if (!showLogModal) {
        setShowLogModal(true);
      }
    },
    onShowFlashCards: () => {
      if (!showFlashCardGameModal) {
        loadAllFlashCards();
      }
    },
    onClose: () => {
      if (showEmailModal) {
        setShowEmailModal(false);
      } else if (showLogModal) {
        setShowLogModal(false);
      } else if (showFlashCardGameModal) {
        setShowFlashCardGameModal(false);
      }
    },
    onRefresh: () => {
      if (!isLoading) {
        loadEmails();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Main Content Area */}
      <div className="flex-1 p-4">
        {/* Voice Commands */}
        <VoiceCommands {...voiceCommandCallbacks} />

        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
            <div className="mb-3 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Gmail Reader
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mt-1">
                Read your (forever and ever) unread emails with AI-powered link summaries.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                {/* Purple accent — no dedicated variant; keep raw button with uniform sizing + dark mode */}
                <button
                  onClick={() => window.open('https://paypal.me/Cadienvan', '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  title="Donate"
                >
                  <LucideDollarSign size={16} />
                  Donate
                </button>
                <Button
                  variant="secondary"
                  onClick={() => window.open('https://github.com/Cadienvan/gmail-reader', '_blank')}
                  leftIcon={<Github size={16} />}
                  title="View on GitHub"
                >
                  GitHub
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowConfigurationModal(true)}
                  leftIcon={<Settings size={16} />}
                  title="Open Configuration"
                >
                  Configuration
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkOllamaStatus}
                  leftIcon={<RefreshCw size={14} />}
                  title="Refresh Ollama Status"
                >
                  Refresh Status
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-full md:w-auto">
              {environmentConfigService.getAiBackend() === 'local' && <OllamaStatusIndicator />}
            </div>
          </div>
        </div>

        {/* Global Actions Section - Available without authentication */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
               <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Quick Actions</h2>
               <p className="text-gray-600 dark:text-gray-300 text-sm">Available features and tools</p>
            </div>
            <div className="flex gap-3">
              {/* Teal accent — no dedicated variant; uniform sizing + dark mode */}
              <button
                onClick={() => setShowTabSummariesModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                <FileText size={18} />
                Tab Summaries
              </button>
              {/* Orange accent — no dedicated variant; uniform sizing + dark mode */}
              <button
                onClick={() => setShowImportExportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                <Download size={18} />
                Import/Export Flash Cards
              </button>
              {/* Purple accent — no dedicated variant; uniform sizing + dark mode */}
              <button
                onClick={loadAllFlashCards}
                disabled={isLoadingFlashCards}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 disabled:opacity-50 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed"
              >
                <Gamepad2 size={18} />
                {isLoadingFlashCards ? 'Loading...' : 'Play Flash Card Game'}
              </button>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        {!isAuthenticated && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 mb-6 border border-transparent dark:border-gray-800">
            <div className="text-center">
              <Mail size={48} className="mx-auto text-blue-500 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect to Gmail</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Authenticate with your Google account to access your unread emails
              </p>
              <Button
                variant="primary"
                onClick={handleAuthenticate}
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* Stats and Actions */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-transparent dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{emails.length}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Unread Emails</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{viewedEmails.length}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Viewed Emails</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowLogModal(true)}
                    leftIcon={<BookOpen size={16} />}
                  >
                    View Log
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowSavedForLaterModal(true)}
                    leftIcon={<Bookmark size={16} />}
                    className="text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 border border-orange-300 dark:border-orange-700"
                  >
                    Saved for later
                  </Button>
                  <Button
                    variant="primary"
                    onClick={refreshEmails}
                    disabled={isLoading || isRetrying}
                    leftIcon={<RefreshCw size={16} className={isLoading || isRetrying ? 'animate-spin' : ''} />}
                  >
                    {isRetrying ? 'Retrying...' : isLoading ? 'Loading...' : 'Refresh Emails'}
                  </Button>
                  <button
                    onClick={() => {
                      if (!gempestService.hasApiKey()) {
                        setShowConfigurationModal(true);
                        return;
                      }
                      if (isGempestRunning) {
                        gempestService.stop();
                        setIsGempestRunning(false);
                      } else {
                        setIsGempestRunning(true);
                        setGempestStatus('Starting Gempest...');
                        setGempestSummaries(new Map());
                        gempestService.onProgress = (msg: string) => setGempestStatus(msg);
                        gempestService.onEmailIndexChange = (idx: number) => setCurrentEmailIndex(idx);
                        gempestService.onSummaryReady = (url: string, summary: LinkSummary) => {
                          setGempestSummaries(prev => new Map(prev).set(url, summary));
                        };
                        setCurrentEmailIndex(0);
                        setShowEmailModal(true);
                        gempestService.start(emails).then(() => {
                          setIsGempestRunning(false);
                        });
                      }
                    }}
                    title={!gempestService.hasApiKey() ? 'Click to configure Gemini API key in Settings' : isGempestRunning ? 'Stop Gempest' : 'Run Gempest'}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                      !gempestService.hasApiKey()
                        ? 'bg-gray-400 hover:bg-gray-500 focus-visible:ring-gray-400'
                        : isGempestRunning
                          ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                          : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 focus-visible:ring-emerald-500'
                    }`}
                  >
                    {isGempestRunning ? <StopCircle size={18} /> : <Sparkles size={18} />}
                    {!gempestService.hasApiKey() ? 'Setup Gempest' : isGempestRunning ? 'Stop Gempest' : 'Run Gempest'}
                  </button>
                </div>
              </div>

              {ollamaStatus === 'unavailable' && !isOllamaWarningDismissed && environmentConfigService.getAiBackend() === 'local' && (
                <Callout variant="warning" icon={<AlertCircle size={20} />}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Ollama Service Required</h3>
                      <p className="text-sm mt-1">
                        Please ensure Ollama is running locally on port 11434 with the deepseek-r1:1.5b model installed.
                        Link summaries will not work without this service.
                      </p>
                      <div className="mt-2 text-xs">
                        <code>ollama pull deepseek-r1:1.5b</code>
                      </div>
                    </div>
                    {environmentConfigService.getSaveForLaterMode() && (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label="Don't show this warning for 30 days. Since you're using 'Save for later' mode, you might not need Ollama immediately."
                        onClick={handleDismissOllamaWarning}
                      >
                        <X size={16} />
                      </IconButton>
                    )}
                  </div>
                  {environmentConfigService.getSaveForLaterMode() && (
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                      <p className="text-xs">
                        Since you're using "Save for later" mode, you can dismiss this warning.
                        Content will be saved without requiring Ollama to be running.
                      </p>
                    </div>
                  )}
                </Callout>
              )}
            </div>

            {/* Email List */}
            {emails.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 border border-transparent dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Unread Emails</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                  {emails.map((email, index) => (
                    <div
                      key={email.id}
                      className={`border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        emailLogService.hasBeenViewed(email.id)
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'border-gray-200 dark:border-gray-700'
                      } cursor-pointer`}
                      onClick={() => {
                        setCurrentEmailIndex(index);
                        setShowEmailModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                              {email.subject}
                            </h3>
                            <SenderSentimentBadge sender={email.from} />
                          </div>
                          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <div>From: {email.from}</div>
                            <div>Date: {new Date(email.date).toLocaleDateString()}</div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            {email.snippet || email.body.substring(0, 150) + '...'}
                          </p>
                        </div>
                        <div className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                          #{index + 1}
                          {emailLogService.hasBeenViewed(email.id) && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">✓ Viewed</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>



                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Page {currentPage}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={handlePrevPage}
                      disabled={prevPageTokens.length === 0 || isLoading}
                      leftIcon={<ChevronLeft size={16} />}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleNextPage}
                      disabled={!nextPageToken || isLoading}
                      rightIcon={<ChevronRight size={16} />}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <Callout variant={isRetrying ? 'warning' : 'danger'} icon={<AlertCircle size={20} />}>
              <h3 className="font-medium">{isRetrying ? 'Retrying' : 'Error'}</h3>
              <p className="text-sm mt-1">{error}</p>
              {!isRetrying && error.includes('manually') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={loadEmails}
                  className="mt-2"
                >
                  Refresh Now
                </Button>
              )}
            </Callout>
          </div>
        )}

        {/* Modals */}
        {showEmailModal && <EmailModal
          emails={emails}
          currentIndex={currentEmailIndex}
          isOpen={showEmailModal}
          onClose={handleCloseModal}
          onNext={handleNextEmail}
          onPrev={handlePrevEmail}
          onEmailMarkedAsRead={handleEmailMarkedAsRead}
          onEmailDeleted={handleEmailDeleted}
          gempestStatus={gempestStatus}
          gempestSummaries={gempestSummaries}
          isGempestRunning={isGempestRunning}
          onStopGempest={() => {
            gempestService.stop();
            setIsGempestRunning(false);
          }}
        />}

        <EmailLogModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          viewedEmails={viewedEmails}
          onRefresh={loadViewedEmails}
        />

        <FlashCardsModal
          isOpen={showFlashCardGameModal}
          onClose={() => setShowFlashCardGameModal(false)}
          flashCards={allFlashCards}
          onSave={async () => {}} // No save needed for game mode
          onDelete={async (id) => {
            try {
              await flashCardService.deleteFlashCard(id);
              // Update the list after deleting
              setAllFlashCards(prev => prev.filter(card => card.id !== id));
            } catch (error) {
              console.error('Failed to delete flash card:', error);
              alert('Failed to delete flash card. Please try again.');
            }
          }}
          title="Flash Card Game"
          gameMode={true}
        />

        <FlashCardImportExport
          isOpen={showImportExportModal}
          onClose={() => setShowImportExportModal(false)}
          onImportComplete={() => {
            // Refresh flash cards data if needed
            console.log('Flash cards imported successfully');
            setShowImportExportModal(false);
          }}
        />

        <ConfigurationModal
          isOpen={showConfigurationModal}
          onClose={() => setShowConfigurationModal(false)}
        />

        <SavedForLaterModal
          isOpen={showSavedForLaterModal}
          onClose={() => setShowSavedForLaterModal(false)}
        />

        <TabSummariesModal
          isOpen={showTabSummariesModal}
          onClose={() => setShowTabSummariesModal(false)}
        />
        </div>
      </div>

      {/* Rules Debug Floater - Monitor rule execution in real-time */}
      {showRulesDebugFloater && (
        <RulesDebugFloater onClose={() => setShowRulesDebugFloater(false)} />
      )}
    </div>
  );
};
