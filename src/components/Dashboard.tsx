import React, { useState, useEffect } from 'react';
import { Mail, Play, BookOpen, AlertCircle, CheckCircle, Gamepad2, RefreshCw, ChevronLeft, ChevronRight, Download, Settings, Github, Zap, Star, Link, Award, Bookmark, Trophy, Calendar } from 'lucide-react';
import type { ParsedEmail, ViewedEmail, FlashCard, ModelConfiguration, QualityAssessmentResult } from '../types';
import { gmailService } from '../services/gmailService';
import { ollamaService } from '../services/ollamaService';
import { emailLogService } from '../utils/emailLogService';
import { flashCardService } from '../services/flashCardService';
import { deepAnalysisCache } from '../services/deepAnalysisCache';
import { emailScoringService } from '../services/emailScoringService';
import { environmentConfigService } from '../services/environmentConfigService';
import { emailCacheService } from '../services/emailCacheService';
import { EmailModal } from './EmailModal';
import { EmailLogModal } from './EmailLogModal';
import { FlashCardsModal } from './FlashCardsModal';
import { FlashCardImportExport } from './FlashCardImportExport';
import { VoiceCommands } from './VoiceCommands';
import { ConfigurationModal } from './ConfigurationModal';
import { DeepAnalysisSidebar } from './DeepAnalysisSidebar';
import { SavedForLaterModal } from './SavedForLaterModal';

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
  const [showDeepAnalysisSidebar, setShowDeepAnalysisSidebar] = useState(false);
  const [showSavedForLaterModal, setShowSavedForLaterModal] = useState(false);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [allFlashCards, setAllFlashCards] = useState<FlashCard[]>([]);
  const [isLoadingFlashCards, setIsLoadingFlashCards] = useState(false);

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

  const startTraversal = () => {
    if (emails.length === 0) {
      setError('No emails to traverse');
      return;
    }
    
    // Start from the first email (top of the list)
    setCurrentEmailIndex(0);
    setShowEmailModal(true);
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
    // Remove the deleted email from the emails array
    setEmails(prevEmails => {
      const emailIndex = prevEmails.findIndex(email => email.id === emailId);
      const filteredEmails = prevEmails.filter(email => email.id !== emailId);
      
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
      }
      // If we deleted the email at the current index, stay at the same index
      // unless it was the last email in the list
      else if (emailIndex === currentEmailIndex && currentEmailIndex >= filteredEmails.length) {
        newIndex = Math.max(0, filteredEmails.length - 1);
      }
      
      // Update the current email index
      setCurrentEmailIndex(newIndex);
      
      return filteredEmails;
    });
  };

  const OllamaStatusIndicator = () => {
    switch (ollamaStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-yellow-600 text-sm px-2.5 py-1.5 bg-yellow-50 rounded-md border border-yellow-100 inline-flex">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span>Checking Ollama service...</span>
          </div>
        );
      case 'available':
        return (
          <div className="flex items-center gap-2 text-green-600 text-sm px-2.5 py-1.5 bg-green-50 rounded-md border border-green-100 inline-flex">
            <CheckCircle size={14} />
            <span>Ollama service ready</span>
          </div>
        );
      case 'unavailable':
        return (
          <div className="flex items-center gap-2 text-red-600 text-sm px-2.5 py-1.5 bg-red-50 rounded-md border border-red-100 inline-flex">
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
    onStartTraversal: () => {
      if (emails.length > 0 && !showEmailModal) {
        setCurrentEmailIndex(emails.length - 1); // Start from bottom
        setShowEmailModal(true);
      }
    },
    onStopTraversal: () => {
      if (showEmailModal) {
        handleCloseModal();
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

  // Helper function to get quality assessment for an email
  const getEmailQuality = (emailId: string): QualityAssessmentResult | null => {
    return deepAnalysisCache.getResult(emailId);
  };

  // Helper function to render quality badge
  const renderQualityBadge = (emailId: string) => {
    const quality = getEmailQuality(emailId);
    
    if (!quality) {
      return null;
    }

    const { isHighQuality, qualityScore, hasLinks, contentType } = quality;

    return (
      <div className="flex items-center gap-2 ml-2">
        {isHighQuality && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <Star size={12} />
            High Quality
          </div>
        )}
        
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
          <Award size={12} />
          {qualityScore}%
        </div>
        
        {hasLinks && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
            <Link size={12} />
            Links
          </div>
        )}
        
        <span className={`px-2 py-1 rounded-full text-xs ${
          contentType === 'full-email' ? 'bg-green-100 text-green-700' :
          contentType === 'links-only' ? 'bg-orange-100 text-orange-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {contentType === 'full-email' ? 'Full' : 
           contentType === 'links-only' ? 'Links' : 'Mixed'}
        </span>
      </div>
    );
  };

  // Helper function to render sender rank badge
  const renderSenderRank = (senderEmail: string) => {
    const scoringConfig = environmentConfigService.getScoringConfig();
    
    if (!scoringConfig.enabled) {
      return null;
    }

    const rank = emailScoringService.getSenderRank(senderEmail);
    const score = emailScoringService.getSenderScore(senderEmail);
    
    if (!rank.allTimeRank || rank.allTimeRank === 0) {
      return null; // No rank if sender has no score
    }

    const getRankColor = (position: number, total: number) => {
      const percentage = position / total;
      if (percentage <= 0.1) return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // Top 10%
      if (percentage <= 0.25) return 'bg-orange-100 text-orange-700 border-orange-200'; // Top 25%
      if (percentage <= 0.5) return 'bg-blue-100 text-blue-700 border-blue-200'; // Top 50%
      return 'bg-gray-100 text-gray-700 border-gray-200'; // Lower 50%
    };

    const allTimeTooltip = `All-time rank: #${rank.allTimeRank} of ${rank.totalSenders} senders`;
    const last90DaysTooltip = rank.last90DaysRank > 0 
      ? `Last 90 days rank: #${rank.last90DaysRank}`
      : `No activity in last 90 days`;
    const pointsTooltip = score ? `${score.totalScore} total points` : '';
    const fullTooltip = [allTimeTooltip, last90DaysTooltip, pointsTooltip].filter(Boolean).join(' | ');

    return (
      <div className="flex items-center gap-1">
        {/* All-time rank */}
        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getRankColor(rank.allTimeRank, rank.totalSenders)}`}
          title={fullTooltip}
        >
          <Trophy size={10} />
          <span>#{rank.allTimeRank}</span>
          {score && (
            <span className="ml-1 text-xs opacity-75">
              ({score.totalScore}pt)
            </span>
          )}
        </div>
        
        {/* 90-day rank badge if different or no activity */}
        {rank.last90DaysRank > 0 && rank.last90DaysRank !== rank.allTimeRank && (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-blue-50 text-blue-700 border-blue-200"
            title={`Last 90 days: #${rank.last90DaysRank}`}
          >
            <Calendar size={10} />
            <span>#{rank.last90DaysRank}</span>
          </div>
        )}
        
        {/* No recent activity indicator */}
        {rank.last90DaysRank === 0 && (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-gray-50 text-gray-500 border-gray-200"
            title="No activity in last 90 days"
          >
            <Calendar size={10} />
            <span>-</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content Area */}
      <div className="flex-1 p-4">
        {/* Voice Commands */}
        <VoiceCommands {...voiceCommandCallbacks} />
        
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
            <div className="mb-3 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Gmail Reader
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Read your (forever and ever) unread emails with AI-powered link summaries.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open('https://github.com/Cadienvan/gmail-reader', '_blank')}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors text-sm"
                  title="View on GitHub"
                >
                  <Github size={16} />
                  GitHub
                </button>
                <button
                  onClick={() => setShowConfigurationModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  title="Open Configuration"
                >
                  <Settings size={16} />
                  Configuration
                </button>
                <button
                  onClick={checkOllamaStatus}
                  className="text-xs md:text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Refresh Ollama Status"
                >
                  <RefreshCw size={14} />
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-full md:w-auto">
              <OllamaStatusIndicator />
            </div>
          </div>
        </div>

        {/* Global Actions Section - Available without authentication */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Quick Actions</h2>
              <p className="text-gray-600 text-sm">Available features and tools</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportExportModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md transition-all duration-200"
              >
                <Download size={18} />
                Import/Export Flash Cards
              </button>
              <button
                onClick={loadAllFlashCards}
                disabled={isLoadingFlashCards}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md disabled:opacity-50 transition-all duration-200"
              >
                <Gamepad2 size={18} />
                {isLoadingFlashCards ? 'Loading...' : 'Play Flash Card Game'}
              </button>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        {!isAuthenticated && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="text-center">
              <Mail size={48} className="mx-auto text-blue-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connect to Gmail</h2>
              <p className="text-gray-600 mb-4">
                Authenticate with your Google account to access your unread emails
              </p>
              <button
                onClick={handleAuthenticate}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Connect Gmail'}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* Stats and Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{emails.length}</div>
                    <div className="text-sm text-gray-600">Unread Emails</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{viewedEmails.length}</div>
                    <div className="text-sm text-gray-600">Viewed Emails</div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <BookOpen size={16} />
                    View Log
                  </button>
                  <button
                    onClick={() => setShowSavedForLaterModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-orange-300 rounded-lg hover:bg-orange-50 text-orange-700"
                  >
                    <Bookmark size={16} />
                    Saved for later
                  </button>
                  <button
                    onClick={() => setShowDeepAnalysisSidebar(!showDeepAnalysisSidebar)}
                    disabled={ollamaStatus === 'unavailable'}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start Deep Analysis with sender selection - choose which senders to analyze and specify content types"
                  >
                    <Zap size={16} />
                    Deep Analysis
                  </button>
                  <button
                    onClick={refreshEmails}
                    disabled={isLoading || isRetrying}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Retrying...
                      </>
                    ) : isLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Refresh Emails
                      </>
                    )}
                  </button>
                  <button
                    onClick={startTraversal}
                    disabled={emails.length === 0 || ollamaStatus === 'unavailable'}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={16} />
                    Start Traversal
                  </button>
                </div>
              </div>

              {ollamaStatus === 'unavailable' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-800">Ollama Service Required</h3>
                      <p className="text-yellow-700 text-sm mt-1">
                        Please ensure Ollama is running locally on port 11434 with the deepseek-r1:1.5b model installed.
                        Link summaries will not work without this service.
                      </p>
                      <div className="mt-2 text-xs text-yellow-600">
                        <code>ollama pull deepseek-r1:1.5b</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email List */}
            {emails.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Unread Emails</h2>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                  {emails.map((email, index) => (
                    <div
                      key={email.id}
                      className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                        emailLogService.hasBeenViewed(email.id) ? 'bg-blue-50 border-blue-200' : ''
                      } cursor-pointer`}
                      onClick={() => {
                        setCurrentEmailIndex(index);
                        setShowEmailModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate hover:text-blue-600">
                            {email.subject}
                          </h3>
                          <div className="mt-1 text-sm text-gray-600">
                            <div>From: {email.from}</div>
                            <div>Date: {new Date(email.date).toLocaleDateString()}</div>
                          </div>
                          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                            {email.snippet || email.body.substring(0, 150) + '...'}
                          </p>
                        </div>
                        <div className="ml-4 text-sm text-gray-500">
                          #{index + 1}
                          {emailLogService.hasBeenViewed(email.id) && (
                            <span className="ml-2 text-blue-600">✓ Viewed</span>
                          )}
                        </div>
                      </div>

                      {/* Quality Assessment Badges */}
                      {renderQualityBadge(email.id)}
                      
                      {/* Sender Rank Badge */}
                      {renderSenderRank(email.from)}
                    </div>
                  ))}
                </div>



                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Page {currentPage}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={prevPageTokens.length === 0 || isLoading}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={!nextPageToken || isLoading}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className={`border rounded-lg p-4 mb-6 ${isRetrying ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className={isRetrying ? 'text-yellow-600 mt-0.5' : 'text-red-600 mt-0.5'} />
              <div>
                <h3 className={`font-medium ${isRetrying ? 'text-yellow-800' : 'text-red-800'}`}>
                  {isRetrying ? 'Retrying' : 'Error'}
                </h3>
                <p className={`text-sm mt-1 ${isRetrying ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
                {!isRetrying && error.includes('manually') && (
                  <button 
                    onClick={loadEmails}
                    className="mt-2 text-sm bg-blue-600 text-white px-4 py-1 rounded-md hover:bg-blue-700"
                  >
                    Refresh Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        <EmailModal
          emails={emails}
          currentIndex={currentEmailIndex}
          isOpen={showEmailModal}
          onClose={handleCloseModal}
          onNext={handleNextEmail}
          onPrev={handlePrevEmail}
          onEmailMarkedAsRead={handleEmailMarkedAsRead}
          onEmailDeleted={handleEmailDeleted}
        />

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
        </div>
      </div>
      
      {/* Deep Analysis Sidebar - Positioned as a lateral sidebar */}
      <DeepAnalysisSidebar
        isVisible={showDeepAnalysisSidebar}
        onToggle={() => setShowDeepAnalysisSidebar(!showDeepAnalysisSidebar)}
        className="fixed right-0 top-0 h-full z-40"
      />
    </div>
  );
};
