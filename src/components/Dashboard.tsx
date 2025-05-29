import React, { useState, useEffect } from 'react';
import { Mail, Play, BookOpen, AlertCircle, CheckCircle, Gamepad2, RefreshCw, ChevronLeft, ChevronRight, Download, Settings } from 'lucide-react';
import type { ParsedEmail, ViewedEmail, FlashCard, ModelConfiguration } from '../types';
import { gmailService } from '../services/gmailService';
import { ollamaService } from '../services/ollamaService';
import { emailLogService } from '../utils/emailLogService';
import { flashCardService } from '../services/flashCardService';
import { EmailModal } from './EmailModal';
import { EmailLogModal } from './EmailLogModal';
import { FlashCardsModal } from './FlashCardsModal';
import { FlashCardImportExport } from './FlashCardImportExport';
import { VoiceCommands } from './VoiceCommands';
import { ConfigurationModal } from './ConfigurationModal';

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
  
  const fetchEmails = async (token?: string): Promise<void> => {
    const result = await gmailService.getUnreadEmails(token);
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Voice Commands */}
      <VoiceCommands {...voiceCommandCallbacks} />
      
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
            <div className="mb-3 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Gmail Email Traversal
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Traverse your unread emails with AI-powered link summaries
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2">
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
                    onClick={loadEmails}
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
      </div>
    </div>
  );
};
