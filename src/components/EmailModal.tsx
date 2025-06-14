import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink, Loader2, FileText, CheckCircle, Mail, BookOpen, ChevronDown, ChevronUp, Trash2, Zap, Filter, AlertCircle, Trophy, Calendar } from 'lucide-react';
import type { ParsedEmail, ExtractedLink, LinkSummary, FlashCard, ModelConfiguration } from '../types';
import { linkService } from '../services/linkService';
import { ollamaService } from '../services/ollamaService';
import { gmailService } from '../services/gmailService';
import { emailLogService } from '../utils/emailLogService';
import { flashCardService } from '../services/flashCardService';
import { tabSummaryStorage } from '../services/tabSummaryStorage';
import { deepAnalysisService } from '../services/deepAnalysisService';
import { sanitizeEmailHTML } from '../utils/htmlSanitizer';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { FlashCardsModal } from './FlashCardsModal';
import { DeepAnalysisSidebar } from './DeepAnalysisSidebar';
import { RegexChecker } from './RegexChecker';
import { environmentConfigService } from '../services/environmentConfigService';
import { emailScoringService } from '../services/emailScoringService';

interface EmailModalProps {
  emails: ParsedEmail[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onEmailMarkedAsRead?: (emailId: string) => void;
  onEmailDeleted?: (emailId: string) => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  emails,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrev,
  onEmailMarkedAsRead,
  onEmailDeleted
}) => {
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLink[]>([]);
  const [linkSummaries, setLinkSummaries] = useState<Map<string, LinkSummary>>(new Map());
  const [emailContent, setEmailContent] = useState<{ body: string; htmlBody?: string } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [hoveredLinkUrl, setHoveredLinkUrl] = useState<string | null>(null);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'close' | 'next' | 'prev' | null>(null);
  const [activeSummaryUrls, setActiveSummaryUrls] = useState<string[]>([]);
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelConfiguration>(() => ollamaService.getModelConfiguration());
  
  // Email deletion state
  const [isDeletingEmail, setIsDeletingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Paste input state
  const [pasteInput, setPasteInput] = useState<string>('');
  const [isPasteInputVisible, setIsPasteInputVisible] = useState<boolean>(false);
  
  // Flash cards state
  const [flashCards, setFlashCards] = useState<FlashCard[]>([]);
  const [isFlashCardsModalOpen, setIsFlashCardsModalOpen] = useState(false);
  const [isGeneratingFlashCards, setIsGeneratingFlashCards] = useState<string | null>(null);
  const [flashCardsError, setFlashCardsError] = useState<string | null>(null);
  
  // Request cancellation state
  const [abortControllers, setAbortControllers] = useState<Map<string, AbortController>>(new Map());
  
  // Content display state
  const [showHtmlContent, setShowHtmlContent] = useState(false);
  
  // Sidebar visibility state with localStorage persistence
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('emailModal_sidebarVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Summary panel visibility state with localStorage persistence
  const [isSummaryVisible, setIsSummaryVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('emailModal_summaryVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Deep analysis sidebar state with localStorage persistence
  const [showDeepAnalysisSidebar, setShowDeepAnalysisSidebar] = useState<boolean>(() => {
    const saved = localStorage.getItem('emailModal_deepAnalysisSidebarVisible');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Deep analysis functionality
  const [isHighQualityEmail, setIsHighQualityEmail] = useState<boolean>(false);
  const [emailQualityResult, setEmailQualityResult] = useState<any>(null);

  // Regex checker state
  const [showRegexChecker, setShowRegexChecker] = useState<boolean>(false);
  const [regexCheckerUrl, setRegexCheckerUrl] = useState<string>('');

  // Save for later mode state
  const saveForLaterMode = environmentConfigService.getSaveForLaterMode();

  // Focus modes state with localStorage persistence
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('emailModal_focusMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [hyperFocusMode, setHyperFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('emailModal_hyperFocusMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const currentEmail = emails[currentIndex];

  // Check if current email is already marked as read
  const isCurrentEmailRead = currentEmail?.isRead || false;

  // Helper function to show notifications
  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    // Create a simple notification (you can enhance this with a proper notification system)
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${
      type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  // Sidebar toggle function
  const toggleSidebar = () => {
    const newVisibility = !isSidebarVisible;
    setIsSidebarVisible(newVisibility);
    localStorage.setItem('emailModal_sidebarVisible', JSON.stringify(newVisibility));
  };

  // Summary panel toggle function
  const toggleSummaryPanel = () => {
    const newVisibility = !isSummaryVisible;
    setIsSummaryVisible(newVisibility);
    localStorage.setItem('emailModal_summaryVisible', JSON.stringify(newVisibility));
  };

  // Deep analysis sidebar toggle function
  const toggleDeepAnalysisSidebar = () => {
    const newVisibility = !showDeepAnalysisSidebar;
    setShowDeepAnalysisSidebar(newVisibility);
    localStorage.setItem('emailModal_deepAnalysisSidebarVisible', JSON.stringify(newVisibility));
  };

  // Focus modes toggle functions
  const toggleFocusMode = () => {
    const newFocusMode = !focusMode;
    console.log('Toggling focus mode (with container queries):', newFocusMode);
    setFocusMode(newFocusMode);
    localStorage.setItem('emailModal_focusMode', JSON.stringify(newFocusMode));
    
    // Disable hyper focus mode when enabling regular focus mode
    if (newFocusMode && hyperFocusMode) {
      setHyperFocusMode(false);
      localStorage.setItem('emailModal_hyperFocusMode', JSON.stringify(false));
    }
  };

  const toggleHyperFocusMode = () => {
    const newHyperFocusMode = !hyperFocusMode;
    setHyperFocusMode(newHyperFocusMode);
    localStorage.setItem('emailModal_hyperFocusMode', JSON.stringify(newHyperFocusMode));
    
    // Disable regular focus mode when enabling hyper focus mode
    if (newHyperFocusMode && focusMode) {
      setFocusMode(false);
      localStorage.setItem('emailModal_focusMode', JSON.stringify(false));
    }
  };

  // Extract links with meaningful titles for hyper focus mode
  const getLinksWithTitles = () => {
    return extractedLinks.filter(link => {
      // Include links that have a meaningful title (not just the URL)
      const hasTitle = link.text && 
                      link.text.trim() !== '' && 
                      link.text !== link.url &&
                      link.text.length > 3 && // Minimum length to be meaningful
                      !link.text.match(/^https?:\/\//); // Not just a URL
      
      return hasTitle;
    });
  };

  // Flash card generation functions8//8
  const generateFlashCards = async (content: string, sourceType: 'link' | 'email', sourceId: string, sourceUrl?: string) => {
    setIsGeneratingFlashCards(sourceId);
    setFlashCardsError(null);
    
    // Create AbortController for this flash card generation
    const controller = new AbortController();
    setAbortControllers(prev => new Map(prev).set(`flashcards-${sourceId}`, controller));
    
    try {
      const cards = await ollamaService.generateFlashCards(content, controller.signal);
      const cardsWithSource = cards.map(card => ({
        ...card,
        sourceType,
        sourceId,
        sourceUrl
      }));
      
      setFlashCards(cardsWithSource);
      setIsFlashCardsModalOpen(true);
    } catch (error) {
      console.error('Failed to generate flash cards:', error);
      if (error instanceof Error && error.message.includes('cancelled')) {
        setFlashCardsError('Flash card generation was cancelled');
      } else {
        setFlashCardsError(error instanceof Error ? error.message : 'Failed to generate flash cards');
      }
    } finally {
      setIsGeneratingFlashCards(null);
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(`flashcards-${sourceId}`);
        return newMap;
      });
    }
  };

  const handleSaveFlashCards = async (cards: FlashCard[]) => {
    try {
      await flashCardService.saveFlashCards(cards);
      setIsFlashCardsModalOpen(false);
      setFlashCards([]);
    } catch (error) {
      console.error('Failed to save flash cards:', error);
      throw error;
    }
  };

  const handleDeleteFlashCard = async (id: number) => {
    try {
      await flashCardService.deleteFlashCard(id);
      setFlashCards(prev => prev.filter(card => card.id !== id));
    } catch (error) {
      console.error('Failed to delete flash card:', error);
      throw error;
    }
  };

  // Improve summary with detailed model
  const handleImproveSummary = async (url: string, originalContent: string) => {
    // Create AbortController for this request
    const controller = new AbortController();
    setAbortControllers(prev => new Map(prev).set(`improve-${url}`, controller));

    // Get the current summary
    const currentSummary = linkSummaries.get(url);
    if (!currentSummary) return;

    // Set loading state for improved summary
    const loadingSummary = {
      ...currentSummary,
      loading: true,
      modelUsed: 'long' as const,
      canUpgrade: false
    };
    
    setLinkSummaries(prev => new Map(prev).set(url, loadingSummary));

    try {
      // Generate improved summary with detailed model
      const improvedSummary = await ollamaService.generateImprovedSummary(originalContent, controller.signal);

      // Create completed improved summary
      const completedSummary = {
        ...currentSummary,
        summary: improvedSummary,
        loading: false,
        modelUsed: 'long' as const,
        canUpgrade: false
      };
      
      // Update state
      setLinkSummaries(prev => new Map(prev).set(url, completedSummary));
      
      // Save improved summary to IndexedDB
      await tabSummaryStorage.saveLinkSummary(url, completedSummary, originalContent);
    } catch (error) {
      // Revert to original summary but show error
      const errorSummary = {
        ...currentSummary,
        loading: false,
        error: `Failed to improve summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      setLinkSummaries(prev => new Map(prev).set(url, errorSummary));
    } finally {
      // Clean up the abort controller
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(`improve-${url}`);
        return newMap;
      });
    }
  };

  const handleMarkAsRead = async () => {
    if (!currentEmail || isCurrentEmailRead) return;

    setIsMarkingAsRead(true);
    try {
      const success = await gmailService.markAsRead(currentEmail.id);
      if (success) {
        // Update the email's read status locally
        currentEmail.isRead = true;
        // Notify parent component
        onEmailMarkedAsRead?.(currentEmail.id);
      } else {
        console.error('Failed to mark email as read');
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  const handleDeleteEmail = async () => {
    if (!currentEmail) return;

    setIsDeletingEmail(true);
    try {
      const success = await gmailService.deleteEmail(currentEmail.id);
      if (success) {
        // Notify parent component - let the parent handle navigation
        onEmailDeleted?.(currentEmail.id);
        // The parent component (Dashboard) will handle the navigation and index updates
      } else {
        console.error('Failed to delete email');
        alert('Failed to delete email. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      alert('Error deleting email. Please try again.');
    } finally {
      setIsDeletingEmail(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleShowDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleNavigationWithConfirm = (action: 'close') => {
    if (!currentEmail?.isRead) {
      setConfirmAction(action);
      setShowConfirmDialog(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = (action: 'close' | 'next' | 'prev') => {
    switch (action) {
      case 'close':
        onClose();
        break;
      case 'next':
        onNext();
        break;
      case 'prev':
        onPrev();
        break;
    }
  };

  const handleConfirmMarkAsRead = async () => {
    if (currentEmail && !currentEmail.isRead) {
      await handleMarkAsRead();
    }
    setShowConfirmDialog(false);
    if (confirmAction) {
      executeAction(confirmAction);
    }
    setConfirmAction(null);
  };

  const handleContinueWithoutMarking = () => {
    setShowConfirmDialog(false);
    if (confirmAction) {
      executeAction(confirmAction);
    }
    setConfirmAction(null);
  };

  const handleCancelAction = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  // Regex checker handlers
  const handleOpenRegexChecker = (url?: string) => {
    setRegexCheckerUrl(url || '');
    setShowRegexChecker(true);
  };

  const handleCloseRegexChecker = () => {
    setShowRegexChecker(false);
    setRegexCheckerUrl('');
  };

  const handleRegexPatternAdded = () => {
    // The RegexChecker component handles pattern addition internally
    // We might need to refresh the links if URL filtering is applied immediately
    if (currentEmail && emailContent) {
      const newLinks = linkService.extractLinksFromHTML(emailContent.htmlBody || emailContent.body);
      setExtractedLinks(newLinks);
    }
  };

  useEffect(() => {
    if (currentEmail) {
      // Reset email-specific states but keep tabs open
      setExtractedLinks([]);
      // Don't reset linkSummaries - keep them for all emails
      setEmailContent(null);
      setHoveredLinkUrl(null);
      // Enable HTML view by default if HTML content is available
      setShowHtmlContent(false); // Start with false, will be updated after content loads
      // Don't reset activeSummaryUrls and currentTabUrl - keep tabs open

      // Clean up any existing highlights first
      const emailContentElement = document.querySelector('.email-content-container');
      if (emailContentElement) {
        removeAllHighlights(emailContentElement);
      }

      // Load email content if not already loaded
      loadEmailContent();

      // Check if current email is high quality from deep analysis
      checkEmailQuality(currentEmail.id);
      loadHighQualityTabs(currentEmail.id);

      // Log the viewed email
      emailLogService.addViewedEmail(currentEmail);
    }
  }, [currentEmail]);
  
  // Note: Removed auto-loading of all saved tabs to prevent "saved for later" content from appearing in email modal
  // Tabs will be loaded on-demand when user clicks on links or through deep analysis for high-quality emails
  
  // Cleanup effect for AbortControllers
  useEffect(() => {
    return () => {
      // Cancel all ongoing requests when component unmounts
      abortControllers.forEach(controller => {
        controller.abort();
      });
      setAbortControllers(new Map());
    };
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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle delete confirmation modal keyboard events first
      if (showDeleteConfirm) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            handleDeleteEmail();
            break;
          case 'Escape':
            event.preventDefault();
            handleCancelDelete();
            break;
        }
        return;
      }

      // Ignore keyboard events if we're typing in an input field or if a dialog is open
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          showConfirmDialog) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (currentIndex > 0) {
            executeAction('prev');
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (currentIndex < emails.length - 1) {
            executeAction('next');
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (currentEmail && !isCurrentEmailRead && !isMarkingAsRead) {
            handleMarkAsRead();
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleShowDeleteConfirm();
          break;
        case 'Escape':
          event.preventDefault();
          if (!showConfirmDialog) {
            handleNavigationWithConfirm('close');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentIndex, emails.length, currentEmail, isCurrentEmailRead, isMarkingAsRead, showConfirmDialog, showDeleteConfirm]);

  // Add click handler for links in email content
  useEffect(() => {
    const handleEmailLinkClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const mouseEvent = event as MouseEvent;
        
        // Check if it's a right-click
        if (mouseEvent.button === 2 || event.type === 'contextmenu') {
          // Right-click: allow default behavior (open in new tab)
          return true;
        }
        
        // Left-click: prevent default and generate summary
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Also prevent the href from being followed
        const originalHref = link.href;
        link.removeAttribute('href');
        setTimeout(() => {
          link.setAttribute('href', originalHref);
        }, 100);
        
        try {
          // Create an ExtractedLink object for the clicked link
          const extractedLink: ExtractedLink = {
            url: originalHref,
            text: link.textContent || originalHref,
            domain: new URL(originalHref).hostname
          };
          
          // Generate summary for the clicked link
          handleLinkClick(extractedLink);
        } catch (error) {
          console.error('Error processing link click:', error);
        }
        
        return false;
      }
    };

    // Use a more aggressive approach with capture phase and multiple event types
    const emailContentElement = document.querySelector('.email-content-container');
    if (emailContentElement) {
      // Add listeners for multiple event types in capture phase
      emailContentElement.addEventListener('click', handleEmailLinkClick, true);
      emailContentElement.addEventListener('mousedown', handleEmailLinkClick, true);
      
      // Also add a direct listener to all existing links
      const existingLinks = emailContentElement.querySelectorAll('a[href]');
      existingLinks.forEach(link => {
        link.addEventListener('click', handleEmailLinkClick, true);
        link.addEventListener('mousedown', handleEmailLinkClick, true);
      });
      
      return () => {
        emailContentElement.removeEventListener('click', handleEmailLinkClick, true);
        emailContentElement.removeEventListener('mousedown', handleEmailLinkClick, true);
        const links = emailContentElement.querySelectorAll('a[href]');
        links.forEach(link => {
          link.removeEventListener('click', handleEmailLinkClick, true);
          link.removeEventListener('mousedown', handleEmailLinkClick, true);
        });
      };
    }
  }, [emailContent]);

  // Effect to re-scan email content for any missed URLs after rendering
  useEffect(() => {
    if (emailContent) {
      // Add a small delay to ensure DOM is fully rendered
      const timeout = setTimeout(() => {
        const emailContentElement = document.querySelector('.email-content-container');
        if (emailContentElement) {
          // Find all anchor tags that might have been dynamically created
          const anchors = emailContentElement.querySelectorAll('a[href]');
          const foundUrls: ExtractedLink[] = [];
          
          anchors.forEach(anchor => {
            const href = (anchor as HTMLAnchorElement).href;
            const text = anchor.textContent || href;
            
            try {
              const urlObj = new URL(href);
              const extractedLink: ExtractedLink = {
                url: href,
                text: text,
                domain: urlObj.hostname
              };
              foundUrls.push(extractedLink);
            } catch (error) {
              // Invalid URL, skip
            }
          });
          
          // Check if we have new URLs that weren't in our extracted links
          const existingUrls = new Set(extractedLinks.map(link => link.url));
          const newUrls = foundUrls.filter(link => !existingUrls.has(link.url));
          
          if (newUrls.length > 0) {
            console.log(`Found ${newUrls.length} additional URLs in rendered content:`, newUrls.map(l => l.domain));
            setExtractedLinks(prev => {
              // Deduplicate and merge
              const combined = [...prev, ...newUrls];
              return combined.filter((link, index, self) => 
                index === self.findIndex(l => l.url === link.url)
              );
            });
          }
        }
      }, 500); // Wait 500ms for DOM to settle
      
      return () => clearTimeout(timeout);
    }
  }, [emailContent, showHtmlContent]);
  useEffect(() => {
    if (emailContent) {
      // Wait for DOM to be fully updated
      setTimeout(() => {
        const emailContentElement = document.querySelector('.email-content-container');
        if (emailContentElement) {
          const links = emailContentElement.querySelectorAll('a[href]');
          links.forEach(link => {
            // Add inline onclick handler as backup
            (link as HTMLAnchorElement).onclick = (e) => {
              // Check if it's a right-click
              if (e.button === 2) {
                // Right-click: allow default behavior
                return true;
              }
              
              // Left-click: prevent default and generate summary
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              
              const originalHref = (link as HTMLAnchorElement).href;
              try {
                const extractedLink: ExtractedLink = {
                  url: originalHref,
                  text: link.textContent || originalHref,
                  domain: new URL(originalHref).hostname
                };
                handleLinkClick(extractedLink);
              } catch (error) {
                console.error('Error in inline click handler:', error);
              }
              
              return false;
            };
            
            // Add oncontextmenu handler to allow right-click menu
            (link as HTMLAnchorElement).oncontextmenu = () => {
              // Allow right-click context menu
              return true;
            };
          });
        }
      }, 100);
    }
  }, [emailContent]);

  // Cleanup highlights when component unmounts or hoveredLinkUrl changes
  useEffect(() => {
    return () => {
      // Clean up highlights when component unmounts
      const emailContentElement = document.querySelector('.email-content-container');
      if (emailContentElement) {
        removeAllHighlights(emailContentElement);
      }
    };
  }, []);

  // Handle hover cleanup
  useEffect(() => {
    if (!hoveredLinkUrl) {
      const emailContentElement = document.querySelector('.email-content-container');
      if (emailContentElement) {
        removeAllHighlights(emailContentElement);
      }
    }
  }, [hoveredLinkUrl]);

  const loadEmailContent = async () => {
    if (!currentEmail) return;

    // Check if email already has content (was fetched with format=full)
    if (currentEmail.body !== '(Content will be loaded when opened)') {
      const content = {
        body: currentEmail.body,
        htmlBody: currentEmail.htmlBody
      };
      setEmailContent(content);
      
      // Auto-enable HTML view if HTML content is available and meaningful
      if (content.htmlBody && content.htmlBody.trim() && content.htmlBody !== content.body) {
        setShowHtmlContent(true);
      }
      
      extractLinksFromContent(currentEmail.body, currentEmail.htmlBody);
      return;
    }

    // Fetch full content from Gmail API
    setIsLoadingContent(true);
    try {
      const content = await gmailService.getEmailContent(currentEmail.id);
      setEmailContent(content);
      
      // Auto-enable HTML view if HTML content is available and meaningful
      if (content.htmlBody && content.htmlBody.trim() && content.htmlBody !== content.body) {
        setShowHtmlContent(true);
      }
      
      extractLinksFromContent(content.body, content.htmlBody);
    } catch (error) {
      console.error('Failed to load email content:', error);
      // Fallback to existing content
      const content = {
        body: currentEmail.body,
        htmlBody: currentEmail.htmlBody
      };
      setEmailContent(content);
      
      // Auto-enable HTML view if HTML content is available and meaningful
      if (content.htmlBody && content.htmlBody.trim() && content.htmlBody !== content.body) {
        setShowHtmlContent(true);
      }
      
      extractLinksFromContent(currentEmail.body, currentEmail.htmlBody);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const extractLinksFromContent = (body: string, htmlBody?: string) => {
    // Extract links from email content
    const textLinks = linkService.extractLinksFromText(body);
    
    // For HTML content, extract from the provided HTML
    // For plain text content, convert text URLs to HTML first, then extract
    let htmlLinks: ExtractedLink[] = [];
    if (htmlBody) {
      htmlLinks = linkService.extractLinksFromHTML(htmlBody);
    } else {
      // Convert plain text URLs to HTML and extract links
      const textAsHtml = linkService.convertTextUrlsToHTML(body);
      htmlLinks = linkService.extractLinksFromHTML(textAsHtml);
    }
    
    // Combine and deduplicate links
    const allLinks = [...textLinks, ...htmlLinks];
    const uniqueLinks = allLinks.filter((link, index, self) => 
      index === self.findIndex(l => l.url === link.url)
    );
    
    console.log(`Extracted ${uniqueLinks.length} unique links from email content:`, uniqueLinks.map(l => l.domain));
    setExtractedLinks(uniqueLinks);
  };

  const handleLinkClick = async (link: ExtractedLink) => {
    // Check if we're in save for later mode
    if (saveForLaterMode) {
      try {
        // Fetch link content without generating summary
        const { content, finalUrl } = await linkService.fetchLinkContent(link.url);
        
        // Use finalUrl as the primary identifier, fallback to original URL if no redirect occurred
        const urlToSave = finalUrl || link.url;
        
        // Save content to storage for later review
        const savedData = {
          url: urlToSave,
          finalUrl,
          summary: '', // No summary in save for later mode
          loading: false,
          savedForLater: true
        };
        
        await tabSummaryStorage.saveLinkSummary(
          urlToSave, 
          savedData, 
          content, 
          finalUrl ? new URL(finalUrl).hostname : new URL(link.url).hostname
        );
        
        // Add scoring points for link save if enabled (same as link open)
        try {
          const scoringConfig = environmentConfigService.getScoringConfig();
          if (scoringConfig.enabled && currentEmail?.from) {
            await emailScoringService.addLinkOpenPoints(
              currentEmail.from,
              currentEmail.from, // Using sender email as name for now
              finalUrl || link.url,
              currentEmail.id
            );
            console.log(`Added ${scoringConfig.linkOpenPoints} points to ${currentEmail.from} for saving link for later`);
          }
        } catch (error) {
          console.error('Failed to add scoring points for saving link for later:', error);
        }
        
        // Show notification instead of creating a tab
        showNotification(`Link content saved for later review: ${finalUrl ? new URL(finalUrl).hostname : new URL(link.url).hostname}`, 'success');
        
      } catch (error) {
        showNotification(`Failed to save link content: ${error instanceof Error ? error.message : 'Unknown error'}`, 'info');
      }
      return;
    }

    // Normal mode: generate summary and create tabs
    // Add the URL to active summaries if not already there
    setActiveSummaryUrls(prev => {
      if (!prev.includes(link.url)) {
        const newUrls = [...prev, link.url];
        // Set as current tab if it's the first one or if no current tab
        if (prev.length === 0) {
          setCurrentTabUrl(link.url);
        }
        return newUrls;
      }
      return prev;
    });
    
    // Set as current tab
    setCurrentTabUrl(link.url);
    
    // Check if we already have a summary for this link
    if (linkSummaries.has(link.url)) {
      // If we already have a summary (success or error), just show it
      return;
    }
    
    // Create AbortController for this request
    const controller = new AbortController();
    setAbortControllers(prev => new Map(prev).set(link.url, controller));
    
    // Set loading state for new link
    setLinkSummaries(prev => new Map(prev).set(link.url, {
      url: link.url,
      summary: '',
      loading: true
    }));

    // Save loading state to IndexedDB
    await tabSummaryStorage.saveLinkSummary(link.url, {
      url: link.url,
      summary: '',
      loading: true
    });

    try {
      // Fetch link content and finalUrl
      const { content, finalUrl } = await linkService.fetchLinkContent(link.url);
      
      // Generate summary with Ollama
      const summary = await ollamaService.generateSummary(content, controller.signal);
      
      // Create updated summary
      const updatedSummary = {
        url: link.url,
        finalUrl,
        summary,
        loading: false,
        modelUsed: 'short' as const,
        canUpgrade: ollamaService.canUpgradeSummary()
      };
      
      // Update state
      setLinkSummaries(prev => new Map(prev).set(link.url, updatedSummary));
      
      // Save completed summary to IndexedDB
      await tabSummaryStorage.saveLinkSummary(link.url, updatedSummary, content, finalUrl ? new URL(finalUrl).hostname : new URL(link.url).hostname);
      
      // Add scoring points for link open if enabled
      try {
        const scoringConfig = environmentConfigService.getScoringConfig();
        if (scoringConfig.enabled && currentEmail?.from) {
          await emailScoringService.addLinkOpenPoints(
            currentEmail.from,
            currentEmail.from, // Using sender email as name for now
            finalUrl || link.url,
            currentEmail.id
          );
          console.log(`Added ${scoringConfig.linkOpenPoints} points to ${currentEmail.from} for link open`);
        }
      } catch (error) {
        console.error('Failed to add scoring points for link open:', error);
      }
    } catch (error) {
      // Create error summary
      const errorSummary = {
        url: link.url,
        summary: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      };
      
      // Update state
      setLinkSummaries(prev => new Map(prev).set(link.url, errorSummary));
      
      // Save error to IndexedDB
      await tabSummaryStorage.saveLinkSummary(link.url, errorSummary);
    } finally {
      // Clean up the abort controller
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(link.url);
        return newMap;
      });
    }
  };

  const handleEmailSummary = async () => {
    if (!emailContent || !currentEmail) return;

    // Check if we're in save for later mode
    if (saveForLaterMode) {
      try {
        // Save email content without generating a summary
        const emailTabId = `email:${currentEmail.id}`;
        const savedContent = {
          url: emailTabId,
          summary: 'Email saved for later review',
          loading: false,
          savedForLater: true
        };
        
        // Save to IndexedDB for later review
        await tabSummaryStorage.saveLinkSummary(
          emailTabId, 
          savedContent, 
          emailContent.body, 
          `Email: ${currentEmail.subject}`
        );
        
        // Add scoring points for email save if enabled (same as email summary)
        try {
          const scoringConfig = environmentConfigService.getScoringConfig();
          if (scoringConfig.enabled && currentEmail.from) {
            await emailScoringService.addEmailSummaryPoints(
              currentEmail.from, 
              currentEmail.from, // Using sender email as name for now, could extract name from "Name <email>" format
              currentEmail.id
            );
            console.log(`Added ${scoringConfig.emailSummaryPoints} points to ${currentEmail.from} for saving email for later`);
          }
        } catch (error) {
          console.error('Failed to add scoring points for saving email for later:', error);
        }
        
        showNotification('Email saved for later review', 'success');
      } catch (error) {
        console.error('Failed to save email for later:', error);
        showNotification('Failed to save email', 'error');
      }
      return;
    }

    // Original summarization logic for normal mode
    const emailTabId = `email:${currentEmail.id}`;
    
    // Add the email summary to active summaries if not already there
    setActiveSummaryUrls(prev => {
      if (!prev.includes(emailTabId)) {
        const newUrls = [...prev, emailTabId];
        // Set as current tab if it's the first one or if no current tab
        if (prev.length === 0) {
          setCurrentTabUrl(emailTabId);
        }
        return newUrls;
      }
      return prev;
    });
    
    // Set as current tab
    setCurrentTabUrl(emailTabId);
    
    // Check if we already have a summary for this email
    if (linkSummaries.has(emailTabId)) {
      // If we already have a summary (success or error), just show it
      return;
    }

    // Create AbortController for this request
    const controller = new AbortController();
    setAbortControllers(prev => new Map(prev).set(emailTabId, controller));

    // Set loading state for email summary
    const loadingSummary = {
      url: emailTabId,
      summary: '',
      loading: true
    };
    
    setLinkSummaries(prev => new Map(prev).set(emailTabId, loadingSummary));
    
    // Save loading state to IndexedDB
    await tabSummaryStorage.saveLinkSummary(emailTabId, loadingSummary);

    try {
      // Generate email summary with Ollama using the loaded content
      const summary = await ollamaService.generateSummary(emailContent.body, controller.signal);

      // Create completed summary
      const completedSummary = {
        url: emailTabId,
        summary,
        loading: false,
        modelUsed: 'short' as const,
        canUpgrade: ollamaService.canUpgradeSummary()
      };
      
      // Update state
      setLinkSummaries(prev => new Map(prev).set(emailTabId, completedSummary));
      
      // Save completed summary to IndexedDB
      await tabSummaryStorage.saveLinkSummary(
        emailTabId, 
        completedSummary, 
        emailContent.body, 
        `Email: ${currentEmail.subject}`
      );
      
      // Add scoring points for email summary if enabled
      try {
        const scoringConfig = environmentConfigService.getScoringConfig();
        if (scoringConfig.enabled && currentEmail.from) {
          await emailScoringService.addEmailSummaryPoints(
            currentEmail.from, 
            currentEmail.from, // Using sender email as name for now, could extract name from "Name <email>" format
            currentEmail.id
          );
          console.log(`Added ${scoringConfig.emailSummaryPoints} points to ${currentEmail.from} for email summary`);
        }
      } catch (error) {
        console.error('Failed to add scoring points for email summary:', error);
      }
    } catch (error) {
      // Create error summary
      const errorSummary = {
        url: emailTabId,
        summary: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      };
      
      // Update state
      setLinkSummaries(prev => new Map(prev).set(emailTabId, errorSummary));
      
      // Save error to IndexedDB
      await tabSummaryStorage.saveLinkSummary(emailTabId, errorSummary);
    } finally {
      // Clean up the abort controller
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(emailTabId);
        return newMap;
      });
    }
  };

  const getActiveSummary = (): LinkSummary | null => {
    if (currentTabUrl && linkSummaries.has(currentTabUrl)) {
      return linkSummaries.get(currentTabUrl) || null;
    }
    return null;
  };

  const handleCloseSummary = async (urlToClose?: string) => {
    const urlToRemove = urlToClose || currentTabUrl;
    if (!urlToRemove) return;
    
    // Cancel any ongoing request for this URL
    const controller = abortControllers.get(urlToRemove);
    if (controller) {
      controller.abort();
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(urlToRemove);
        return newMap;
      });
    }
    
    // Also cancel flash card generation if it's for this URL
    const flashCardController = abortControllers.get(`flashcards-${urlToRemove}`);
    if (flashCardController) {
      flashCardController.abort();
      setAbortControllers(prev => {
        const newMap = new Map(prev);
        newMap.delete(`flashcards-${urlToRemove}`);
        return newMap;
      });
      setIsGeneratingFlashCards(null);
    }
    
    // Remove from IndexedDB
    try {
      // Delete from IndexedDB when a tab is closed so it doesn't reappear on refresh
      await tabSummaryStorage.deleteTab(urlToRemove);
    } catch (error) {
      console.error('Failed to delete tab from storage:', error);
    }
    
    setActiveSummaryUrls(prev => {
      const newUrls = prev.filter(url => url !== urlToRemove);
      
      // If we're closing the current tab, switch to another tab or set to null
      if (urlToRemove === currentTabUrl) {
        if (newUrls.length > 0) {
          setCurrentTabUrl(newUrls[0]);
        } else {
          setCurrentTabUrl(null);
        }
      }
      
      return newUrls;
    });
  };

  const handleTabSwitch = (url: string) => {
    setCurrentTabUrl(url);
    
    // Highlight any links in the email that match this URL
    const emailContentElement = document.querySelector('.email-content-container');
    if (emailContentElement) {
      // First clean up any existing highlights
      removeAllHighlights(emailContentElement);
      // Then add new highlights
      highlightLinkInContent(emailContentElement, url);
    }
  };

  const handleLinkHover = (url: string | null) => {
    setHoveredLinkUrl(url);
    
    if (url) {
      const emailContentElement = document.querySelector('.email-content-container');
      if (emailContentElement) {
        // Remove existing highlights first
        removeAllHighlights(emailContentElement);
        // Add new highlights
        highlightLinkInContent(emailContentElement, url);
      }
    }
  };
  
  // Handle paste input for URL or text
  const handlePasteInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPasteInput(e.target.value);
  };
  
  const togglePasteInput = () => {
    setIsPasteInputVisible(prev => !prev);
    if (!isPasteInputVisible) {
      // Reset input when showing
      setPasteInput('');
    }
  };
  
  const processUserInput = async () => {
    if (!pasteInput.trim()) return;
    
    // Check if the input is a URL
    const isUrl = (() => {
      try {
        // Check if it starts with http:// or https://, or has a common domain format
        const trimmedInput = pasteInput.trim();
        if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
          new URL(trimmedInput);
          return true;
        }
        
        // Try to see if it's a domain without protocol
        if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+/.test(trimmedInput)) {
          new URL('https://' + trimmedInput);
          return true;
        }
        
        return false;
      } catch (e) {
        return false;
      }
    })();
    
    if (isUrl) {
      // Handle as URL - add protocol if missing
      let normalizedUrl = pasteInput.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      // Create the link object
      try {
        const extractedLink: ExtractedLink = {
          url: normalizedUrl,
          text: normalizedUrl,
          domain: new URL(normalizedUrl).hostname
        };
        await handleLinkClick(extractedLink);
        
        // Show confirmation for user
        // Reset input and hide the input area on successful processing
        setPasteInput('');
        // Keep the input area open to allow more pastes
      } catch (error) {
        console.error('Failed to process URL:', error);
        alert(`Failed to process URL: ${error instanceof Error ? error.message : 'Invalid URL format'}`);
      }
    } else {
      // Handle as plain text - need a unique ID for the content
      const contentId = `text-${Date.now()}`;
      
      // Create AbortController for this request
      const controller = new AbortController();
      setAbortControllers(prev => new Map(prev).set(contentId, controller));
      
      // Add to active summaries
      const fakeUrl = `text://${contentId}`;
      
      // Set loading state
      setLinkSummaries(prev => new Map(prev).set(fakeUrl, {
        url: fakeUrl,
        summary: '',
        loading: true
      }));
      
      // Add to active tabs
      setActiveSummaryUrls(prev => [...prev, fakeUrl]);
      setCurrentTabUrl(fakeUrl);
      
      // Generate summary directly from text
      try {
        const summary = await ollamaService.generateSummary(pasteInput, controller.signal);
        
        // Update with the summary
        const updatedSummary = {
          url: fakeUrl,
          summary,
          loading: false,
          modelUsed: 'short' as const,
          canUpgrade: ollamaService.canUpgradeSummary()
        };
        
        setLinkSummaries(prev => new Map(prev).set(fakeUrl, updatedSummary));
        
        // Save to storage
        await tabSummaryStorage.saveLinkSummary(fakeUrl, updatedSummary, pasteInput, 'Pasted Text');
        
        // Reset input but keep the input area open to allow more pastes
        setPasteInput('');
      } catch (error) {
        console.error('Failed to generate summary for pasted text:', error);
        
        // Update with error
        const errorSummary = {
          url: fakeUrl,
          summary: '',
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to generate summary'
        };
        
        setLinkSummaries(prev => new Map(prev).set(fakeUrl, errorSummary));
        
        // Save error to storage
        await tabSummaryStorage.saveLinkSummary(fakeUrl, errorSummary, pasteInput, 'Pasted Text');
        
        // Don't clear the input so the user can try again
      } finally {
        // Clean up abort controller
        setAbortControllers(prev => {
          const newMap = new Map(prev);
          newMap.delete(contentId);
          return newMap;
        });
      }
    }
  };

  const removeAllHighlights = (container: Element) => {
    try {
      // Remove highlights from text nodes (created by our highlighting)
      const existingHighlights = container.querySelectorAll('.link-highlight');
      existingHighlights.forEach(highlight => {
        const parent = highlight.parentNode;
        if (parent && highlight.textContent) {
          // Replace the highlight span with its text content
          const textNode = document.createTextNode(highlight.textContent);
          parent.replaceChild(textNode, highlight);
        }
      });

      // Normalize text nodes to merge adjacent text nodes
      try {
        container.normalize();
      } catch (e) {
        // Ignore normalization errors
      }

      // Remove highlight classes from link elements  
      const linkElements = container.querySelectorAll('a[href]');
      linkElements.forEach(linkElement => {
        linkElement.classList.remove('link-highlight');
      });

      // Clean up any broken HTML structure from previous highlighting attempts
      const brokenSpans = container.querySelectorAll('span:not([class]):empty');
      brokenSpans.forEach(span => span.remove());
      
    } catch (error) {
      console.warn('Failed to remove highlights:', error);
    }
  };

  const highlightLinkInContent = (container: Element, url: string) => {
    let highlightedElement: Element | null = null;

    try {
      // First, try to find exact matches in href attributes (more reliable for HTML links)
      const linkElements = container.querySelectorAll('a[href]');
      for (const linkElement of linkElements) {
        const href = linkElement.getAttribute('href');
        if (href && (href === url || href.includes(url) || url.includes(href))) {
          linkElement.classList.add('link-highlight');
          highlightedElement = linkElement;
          break;
        }
      }

      // If no HTML link found, search in text nodes (but only for non-HTML content)
      if (!highlightedElement) {
        // Check if we're dealing with HTML content or plain text
        const hasHtmlElements = container.querySelector('div, p, span, br, img');
        
        // Only try text highlighting for plain text content to avoid breaking HTML structure
        if (!hasHtmlElements) {
          const textContent = container.textContent || '';
          if (textContent.includes(url)) {
            // Try to find and highlight text nodes containing the URL
            const walker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: (node) => {
                  return node.textContent && node.textContent.includes(url) 
                    ? NodeFilter.FILTER_ACCEPT 
                    : NodeFilter.FILTER_SKIP;
                }
              }
            );

            let node;
            while (node = walker.nextNode()) {
              const textNode = node as Text;
              const text = textNode.textContent || '';
              const urlIndex = text.indexOf(url);
              
              if (urlIndex !== -1) {
                const beforeText = text.substring(0, urlIndex);
                const urlText = text.substring(urlIndex, urlIndex + url.length);
                const afterText = text.substring(urlIndex + url.length);

                const fragment = document.createDocumentFragment();
                
                if (beforeText) {
                  fragment.appendChild(document.createTextNode(beforeText));
                }

                const highlight = document.createElement('span');
                highlight.className = 'link-highlight';
                highlight.textContent = urlText;
                fragment.appendChild(highlight);

                if (afterText) {
                  fragment.appendChild(document.createTextNode(afterText));
                }

                textNode.parentNode?.replaceChild(fragment, textNode);
                highlightedElement = highlight;
                break;
              }
            }
          }
        } else {
          // For HTML content, try a different approach - look for text content that matches
          const allElements = container.querySelectorAll('*');
          for (const element of allElements) {
            if (element.textContent && element.textContent.includes(url) && !element.querySelector('*')) {
              // This is a leaf element containing our URL
              const originalContent = element.innerHTML;
              const highlightedContent = originalContent.replace(
                new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                `<span class="link-highlight">${url}</span>`
              );
              if (highlightedContent !== originalContent) {
                element.innerHTML = highlightedContent;
                highlightedElement = element.querySelector('.link-highlight');
                break;
              }
            }
          }
        }
      }

      // Scroll to the highlighted element if found
      if (highlightedElement) {
        setTimeout(() => {
          highlightedElement?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest' 
          });
        }, 50);
      }
    } catch (error) {
      console.warn('Failed to highlight link in content:', error);
    }
  };

  // Deep analysis functions
  const checkEmailQuality = async (emailId: string) => {
    try {
      const qualityResult = deepAnalysisService.getEmailQualityResult(emailId);
      setEmailQualityResult(qualityResult);
      setIsHighQualityEmail(qualityResult?.isHighQuality || false);
    } catch (error) {
      console.error('Failed to check email quality:', error);
    }
  };

  const loadHighQualityTabs = async (emailId: string) => {
    try {
      // Check if this email has been processed by deep analysis
      const metadata = await tabSummaryStorage.getEmailMetadata(emailId);
      if (!metadata) return;

      // If email was marked as high quality, load its pre-processed tabs
      if (metadata.qualityScore >= deepAnalysisService.getConfig().qualityThreshold) {
        console.log(`Loading pre-processed tabs for high-quality email: ${metadata.subject}`);
        
        // Get all saved tabs that might belong to this email
        const savedTabs = await tabSummaryStorage.getAllTabs();
        
        // Filter out "saved for later" content (items without summaries or with specific "saved for later" summaries)
        const properTabs = savedTabs.filter(tab => 
          tab.summary && // Must have a summary
          tab.summary !== 'Email saved for later review' && // Not email saved for later
          tab.summary !== 'Link content saved for later review' // Not link saved for later
        );
        
        // Filter tabs that were likely created around the time this email was processed
        const emailProcessTime = metadata.processedAt;
        const timeWindow = 60 * 60 * 1000; // 1 hour window
        
        const relatedTabs = properTabs.filter(tab => 
          Math.abs(tab.lastOpened - emailProcessTime) < timeWindow
        );

        // Load the related tabs into the current session
        const newSummaries = new Map(linkSummaries);
        const newActiveUrls: string[] = [];

        for (const tab of relatedTabs.slice(0, 5)) { // Limit to 5 tabs to avoid overwhelming
          if (tab.summaryReady && tab.summary) {
            const linkSummary = tabSummaryStorage.toLinkSummary(tab);
            newSummaries.set(tab.url, linkSummary);
            newActiveUrls.push(tab.url);
          }
        }

        if (newActiveUrls.length > 0) {
          setLinkSummaries(newSummaries);
          setActiveSummaryUrls(prev => [...new Set([...prev, ...newActiveUrls])]);
          
          // Set first tab as current if no tab is currently active
          if (!currentTabUrl && newActiveUrls.length > 0) {
            setCurrentTabUrl(newActiveUrls[0]);
          }
          
          console.log(`Auto-loaded ${newActiveUrls.length} tabs for high-quality email`);
        }
      }
    } catch (error) {
      console.error('Failed to load high-quality tabs:', error);
      // Don't throw the error, just log it to prevent blocking the email modal
      if (error instanceof Error && error.message.includes('VersionError')) {
        console.warn('Database version conflict detected. Please refresh the page to resolve.');
      }
    }
  };

  if (!isOpen || !currentEmail) return null;

  const activeSummary = getActiveSummary();

  return (
    <>      <style>
        {`
          .email-content-container & {
            .link-highlight {
              background-color: #fef08a !important;
              padding: 2px 4px !important;
              border-radius: 4px !important;
              font-weight: 500 !important;
              box-shadow: 0 0 0 2px #eab308 !important;
              transition: all 0.2s ease !important;
              position: relative !important;
              z-index: 10 !important;
              display: inline !important;
            }
            
            a {
              color: #3b82f6 !important;
              text-decoration: underline !important;
              cursor: pointer !important;
              position: relative !important;
            }
            
            a:hover {
              background-color: #ddd6fe !important;
              transition: background-color 0.2s ease !important;
            }
            
            a:hover::after {
              content: "Click for AI summary" !important;
              position: absolute !important;
              top: -30px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              background: #1f2937 !important;
              color: white !important;
              padding: 4px 8px !important;
              border-radius: 4px !important;
              font-size: 12px !important;
              white-space: nowrap !important;
              z-index: 1000 !important;
              pointer-events: none !important;
            }
            
            a.link-highlight {
              background-color: #fef08a !important;
              box-shadow: 0 0 0 2px #eab308 !important;
            }

            a.link-highlight:hover {
              background-color: #fef08a !important;
            }

            /* Ensure highlighting works in both HTML and text content */
            .link-highlight {
              animation: highlight-pulse 0.5s ease-in-out;
            }
          }

          /* Focus Mode Styles with Container Queries */
          .email-content-container.focus-mode {
            container-type: inline-size;
          }
          
          /* Default: make all elements semi-transparent */
          .email-content-container.focus-mode .prose *:not(:has(a)),
          .email-content-container.focus-mode .email-html-content *:not(:has(a)) {
            opacity: 0.3 !important;
            transition: opacity 0.2s ease !important;
          }
          
          /* Keep elements that contain links at full opacity */
          .email-content-container.focus-mode .prose *:has(a),
          .email-content-container.focus-mode .email-html-content *:has(a) {
            opacity: 1 !important;
          }
          
          /* Keep ALL control elements at full opacity */
          .email-content-container.focus-mode button,
          .email-content-container.focus-mode button *,
          .email-content-container.focus-mode .content-toggle-button,
          .email-content-container.focus-mode .content-toggle-button *,
          .email-content-container.focus-mode .bg-indigo-50,
          .email-content-container.focus-mode .bg-indigo-50 *,
          .email-content-container.focus-mode .bg-blue-50,
          .email-content-container.focus-mode .bg-blue-50 *,
          .email-content-container.focus-mode textarea,
          .email-content-container.focus-mode input {
            opacity: 1 !important;
          }
          
          /* Enhance links with subtle highlighting in focus mode */
          .email-content-container.focus-mode a[href] {
            background-color: #fef08a !important;
            color: #1e40af !important;
            text-decoration: underline !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            box-shadow: 0 0 0 1px #eab308 !important;
            font-weight: 600 !important;
            opacity: 1 !important;
            display: inline !important;
          }
          
          /* Enhanced hover effects for links in focus mode */
          .email-content-container.focus-mode a[href]:hover {
            background-color: #fed7aa !important;
            box-shadow: 0 0 0 2px #d97706 !important;
            transform: scale(1.02) !important;
            transition: all 0.2s ease !important;
          }
          
          /* Keep hyper focus elements at full opacity */
          .email-content-container.focus-mode .hyper-focus-links-container,
          .email-content-container.focus-mode .hyper-focus-links-container *,
          .email-content-container.focus-mode .hyper-focus-separator,
          .email-content-container.focus-mode .hyper-focus-separator * {
            opacity: 1 !important;
          }
          
          /* Fallback for browsers that don't support :has() */
          @supports not selector(:has(a)) {
            .email-content-container.focus-mode .prose *,
            .email-content-container.focus-mode .email-html-content * {
              opacity: 0.4 !important;
              transition: opacity 0.2s ease !important;
            }
            
            .email-content-container.focus-mode a[href],
            .email-content-container.focus-mode a[href] * {
              opacity: 1 !important;
              background-color: #fef08a !important;
              color: #1e40af !important;
              font-weight: 600 !important;
            }
          }

          /* Hyper Focus Mode Styles */
          .hyper-focus-links-container {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border: 2px solid #3b82f6;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }

          .hyper-focus-links-container h3 {
            color: #1e40af !important;
            margin: 0 0 12px 0 !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }

          .hyper-focus-link-item {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            padding: 8px 12px !important;
            margin: 4px 0 !important;
            background: white !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
          }

          .hyper-focus-link-item:hover {
            background: #f1f5f9 !important;
            border-color: #3b82f6 !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
          }

          .hyper-focus-link-domain {
            font-weight: 600 !important;
            color: #3b82f6 !important;
            font-size: 13px !important;
            min-width: 120px !important;
            flex-shrink: 0 !important;
          }

          .hyper-focus-link-title {
            color: #374151 !important;
            font-size: 14px !important;
            flex: 1 !important;
            line-height: 1.4 !important;
          }

          .hyper-focus-separator {
            margin: 20px 0 !important;
            padding: 12px !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            text-align: center !important;
            color: #6b7280 !important;
            font-weight: 500 !important;
            font-size: 14px !important;
          }

          @keyframes highlight-pulse {
            0% { box-shadow: 0 0 0 2px #eab308; }
            50% { box-shadow: 0 0 0 4px #eab308; }
            100% { box-shadow: 0 0 0 2px #eab308; }
          }

          .email-html-content & {
            /* Reset and isolate styles */
            all: initial;
            display: block;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #1f2937;
            background: transparent;
            
            /* Prevent style bleeding */
            contain: style;
            isolation: isolate;
            
            /* Allow scrolling and text selection */
            overflow-wrap: break-word;
            word-wrap: break-word;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            user-select: text;

            /* Reset common email elements to safe defaults */
            * {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            table {
              border-collapse: collapse;
              width: 100%;
              table-layout: fixed;
            }

            img {
              max-width: 100% !important;
              height: auto !important;
              display: block;
              margin: 0 auto;
            }

            p {
              margin: 0 0 1em 0;
            }

            h1, h2, h3, h4, h5, h6 {
              margin: 1em 0 0.5em 0;
              font-weight: bold;
            }

            h1 { font-size: 2em; }
            h2 { font-size: 1.5em; }
            h3 { font-size: 1.17em; }
            h4 { font-size: 1em; }
            h5 { font-size: 0.83em; }
            h6 { font-size: 0.67em; }

            ul, ol {
              margin: 1em 0;
              padding-left: 2em;
            }

            li {
              margin: 0.5em 0;
            }

            blockquote {
              margin: 1em 0;
              padding-left: 1em;
              border-left: 4px solid #e5e7eb;
              color: #6b7280;
            }

            pre {
              background: #f3f4f6;
              padding: 1em;
              border-radius: 4px;
              overflow-x: auto;
              white-space: pre-wrap;
            }

            code {
              background: #f3f4f6;
              padding: 0.125em 0.25em;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
            }

            /* Ensure links in email HTML content also get the click handlers */
            a {
              color: #3b82f6 !important;
              text-decoration: underline !important;
              cursor: pointer !important;
              position: relative !important;
            }

            a:hover {
              background-color: #ddd6fe !important;
              transition: background-color 0.2s ease !important;
            }

            a:hover::after {
              content: "Click for AI summary" !important;
              position: absolute !important;
              top: -30px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              background: #1f2937 !important;
              color: white !important;
              padding: 4px 8px !important;
              border-radius: 4px !important;
              font-size: 12px !important;
              white-space: nowrap !important;
              z-index: 1000 !important;
              pointer-events: none !important;
            }

            a.link-highlight {
              background-color: #fef08a !important;
              box-shadow: 0 0 0 2px #eab308 !important;
            }

            a.link-highlight:hover {
              background-color: #fef08a !important;
            }
          }

          /* Content toggle buttons */
          .content-toggle-button {
            background: white;
            border: none;
            color: #6b7280;
          }

          .content-toggle-button.active {
            background: #3b82f6;
            color: white;
          }

          .content-toggle-button:not(.active):hover {
            background: #f3f4f6;
            color: #374151;
          }
        `}
      </style>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold truncate flex-1 mr-4 flex items-center gap-2">
            {/* Sender Rank Badge */}
            {(() => {
              const scoringConfig = environmentConfigService.getScoringConfig();
              if (!scoringConfig.enabled) return null;
              
              const rank = emailScoringService.getSenderRank(currentEmail.from);
              const score = emailScoringService.getSenderScore(currentEmail.from);
              
              if (!rank.allTimeRank || rank.allTimeRank === 0) return null;
              
              const getRankColor = (position: number, total: number) => {
                const percentage = position / total;
                if (percentage <= 0.1) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                if (percentage <= 0.25) return 'bg-orange-100 text-orange-800 border-orange-200';
                if (percentage <= 0.5) return 'bg-blue-100 text-blue-800 border-blue-200';
                return 'bg-gray-100 text-gray-800 border-gray-200';
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
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-blue-100 text-blue-800 border-blue-200"
                      title={`Last 90 days: #${rank.last90DaysRank}`}
                    >
                      <Calendar size={10} />
                      <span>#{rank.last90DaysRank}</span>
                    </div>
                  )}
                  
                  {/* No recent activity indicator */}
                  {rank.last90DaysRank === 0 && (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-gray-100 text-gray-500 border-gray-200"
                      title="No activity in last 90 days"
                    >
                      <Calendar size={10} />
                      <span>-</span>
                    </div>
                  )}
                </div>
              );
            })()}
            {currentEmail.subject}
            {isHighQualityEmail && (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full" title={emailQualityResult ? `Quality: ${emailQualityResult.qualityScore}% | Diversity: ${emailQualityResult.diversityScore}%` : 'High Quality Email'}>
                <Zap size={12} />
                <span>High Quality</span>
                {emailQualityResult && (
                  <span className="ml-1 text-xs opacity-75">
                    {emailQualityResult.qualityScore}%
                  </span>
                )}
              </div>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* Keyboard shortcuts info */}
            <div className="text-xs text-gray-500 mr-4 hidden sm:block">
              <div className="flex gap-3">
                <span>← Prev</span>
                <span>→ Next</span>
                <span>↑ Read</span>
                <span>↓ Delete</span>
                <span>Esc Close</span>
              </div>
            </div>
            
            {/* Mark as Read Button */}
            <button
              onClick={handleMarkAsRead}
              disabled={isCurrentEmailRead || isMarkingAsRead}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
                isCurrentEmailRead 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
              title={isCurrentEmailRead ? 'Email is marked as read' : 'Mark email as read'}
            >
              {isMarkingAsRead ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Marking...
                </>
              ) : isCurrentEmailRead ? (
                <>
                  <CheckCircle size={14} />
                  Read
                </>
              ) : (
                <>
                  <Mail size={14} />
                  Mark as Read
                </>
              )}
            </button>
            
            {/* Delete Button */}
            <button
              onClick={handleShowDeleteConfirm}
              disabled={isDeletingEmail}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              title="Delete email (move to trash)"
            >
              {isDeletingEmail ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete
                </>
              )}
            </button>
            
            {/* URL Filter Button */}
            <button
              onClick={() => handleOpenRegexChecker()}
              className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-purple-600 text-white hover:bg-purple-700"
              title="Open URL regex pattern checker"
            >
              <Filter size={14} />
              URL Filter
            </button>
            
            <span className="text-sm text-gray-500">
              {currentIndex + 1} of {emails.length}
            </span>
            <button
              onClick={() => executeAction('prev')}
              disabled={currentIndex === 0}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
              title="Previous email"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => executeAction('next')}
              disabled={currentIndex === emails.length - 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
              title="Next email"
            >
              <ChevronRight size={20} />
            </button>
            
            {/* Deep Analysis Button */}
            <button
              onClick={toggleDeepAnalysisSidebar}
              className={`p-2 rounded hover:bg-gray-100 ${showDeepAnalysisSidebar ? 'bg-purple-100 text-purple-700' : ''}`}
              title="Deep Analysis"
            >
              <Zap size={20} />
            </button>
            
            <button
              onClick={() => handleNavigationWithConfirm('close')}
              className="p-2 rounded hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top row: Email content (70%) and Links (30%) */}
          <div className={`flex ${
            activeSummary && (activeSummary.loading || activeSummary.summary || activeSummary.error) 
              ? 'flex-1 min-h-0' 
              : 'flex-1'
          } overflow-hidden`}>
            {/* Email Content - responsive width based on sidebar visibility */}
            <div className={`${isSidebarVisible ? 'w-[70%]' : 'w-full'} ${isSidebarVisible ? 'border-r' : ''} flex flex-col overflow-hidden relative`}>
              <div className={`flex-1 overflow-y-auto p-4 email-content-container ${focusMode ? 'focus-mode' : ''}`}>
              
              {/* Paste URL/Text Input Section - Full width when sidebar is hidden */}
              {!isSidebarVisible && (
                <div className="mb-4 border-b pb-3 bg-indigo-50 p-3 rounded-md">
                  <button 
                    onClick={togglePasteInput}
                    className="mb-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full transition-colors inline-flex items-center gap-1"
                  >
                    <span>{isPasteInputVisible ? 'Hide' : 'Paste URL or text for summary'}</span>
                  </button>
                  
                  {isPasteInputVisible && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Paste URL or text here. URLs will be processed as links, any other content will be summarized as text."
                        className="w-full p-2 border rounded text-sm min-h-[80px]"
                        value={pasteInput}
                        onChange={handlePasteInputChange}
                        onPaste={() => {
                          // Use setTimeout to ensure the paste event completes
                          setTimeout(() => {
                            if (pasteInput.trim()) {
                              processUserInput();
                            }
                          }, 50);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            processUserInput();
                          }
                        }}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Press Ctrl+Enter to process</span>
                        <button
                          onClick={processUserInput}
                          disabled={!pasteInput.trim()}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                        >
                          Get Summary
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mb-4">
                <div className="mt-2">
                  <button 
                    onClick={handleEmailSummary}
                    disabled={linkSummaries.get(`email:${currentEmail.id}`)?.loading}
                    className="inline-flex items-center gap-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 py-1 px-3 rounded-full transition-colors disabled:opacity-50"
                  >
                    {linkSummaries.get(`email:${currentEmail.id}`)?.loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Generating summary...</span>
                      </>
                    ) : (
                      <>
                        <FileText size={14} />
                        <span>{saveForLaterMode ? 'Save for later' : 'Summarize Email'}</span>
                      </>
                    )}
                  </button>
                  
                  {/* Content Type Toggle */}
                  {emailContent?.htmlBody && (
                    <div className="inline-flex ml-3 rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setShowHtmlContent(false)}
                        className={`px-3 py-1 text-sm transition-colors content-toggle-button ${
                          !showHtmlContent ? 'active' : ''
                        }`}
                      >
                        Text
                      </button>
                      <button
                        onClick={() => setShowHtmlContent(true)}
                        className={`px-3 py-1 text-sm transition-colors content-toggle-button ${
                          showHtmlContent ? 'active' : ''
                        }`}
                      >
                        HTML
                      </button>
                    </div>
                  )}

                  {/* Focus Mode Toggle Buttons */}
                  <div className="inline-flex ml-3 rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={toggleFocusMode}
                      className={`px-3 py-1 text-sm transition-colors content-toggle-button ${
                        focusMode ? 'active' : ''
                      }`}
                      title="Focus mode - highlight links by dimming other text"
                    >
                      Focus
                    </button>
                    <button
                      onClick={toggleHyperFocusMode}
                      className={`px-3 py-1 text-sm transition-colors content-toggle-button ${
                        hyperFocusMode ? 'active' : ''
                      }`}
                      title="Hyper focus mode - show only meaningful links first"
                    >
                      Hyper
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="prose max-w-none">
                {isLoadingContent ? (
                  <div className="flex items-center gap-2 text-gray-600 p-4">
                    <Loader2 size={20} className="animate-spin" />
                    Loading email content...
                  </div>
                ) : (
                  <>
                    {/* Hyper Focus Mode: Show links with titles first */}
                    {hyperFocusMode && (
                      <>
                        {(() => {
                          const linksWithTitles = getLinksWithTitles();
                          return linksWithTitles.length > 0 ? (
                            <div className="hyper-focus-links-container">
                              <h3>
                                🔗 Links in this Email ({linksWithTitles.length})
                              </h3>
                              {linksWithTitles.map((link, index) => (
                                <div 
                                  key={index}
                                  className="hyper-focus-link-item"
                                  onClick={() => handleLinkClick(link)}
                                >
                                  <div className="hyper-focus-link-domain">
                                    {link.domain}
                                  </div>
                                  <div className="hyper-focus-link-title">
                                    {link.text}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="hyper-focus-links-container">
                              <h3>
                                🔗 No meaningful links found
                              </h3>
                              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                                This email doesn't contain links with descriptive titles.
                              </p>
                            </div>
                          );
                        })()}
                        
                        <div className="hyper-focus-separator">
                          📧 Email Content Below
                        </div>
                      </>
                    )}

                    {/* Email Content */}
                    <div>
                      {emailContent ? (
                        showHtmlContent && emailContent.htmlBody ? (
                          <div 
                            className="email-html-content"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeEmailHTML(emailContent.htmlBody)
                            }}
                          />
                        ) : (
                          <div 
                            className="email-html-content"
                            dangerouslySetInnerHTML={{
                              __html: linkService.convertTextUrlsToHTML(emailContent.body)
                            }}
                          />
                        )
                      ) : (
                        <div 
                          className="email-html-content"
                          dangerouslySetInnerHTML={{
                            __html: linkService.convertTextUrlsToHTML(currentEmail.body)
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
              </div>
              
              {/* Show sidebar button when hidden */}
              {!isSidebarVisible && (
                <button
                  onClick={toggleSidebar}
                  className="absolute top-4 right-4 p-2 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 transition-colors z-10"
                  title="Show links panel"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
              )}
            </div>

            {/* Links Panel - conditional visibility */}
            {isSidebarVisible && (
              <div className="w-[30%] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
              {/* Paste URL/Text Input Section */}
              <div className="mb-4 border-b pb-3 bg-indigo-50 p-3 rounded-md">
                <button 
                  onClick={togglePasteInput}
                  className="mb-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full transition-colors inline-flex items-center gap-1"
                >
                  <span>{isPasteInputVisible ? 'Hide' : 'Paste URL or text for summary'}</span>
                </button>
                
                {isPasteInputVisible && (
                  <div className="space-y-2">
                    <textarea
                      placeholder="Paste URL or text here. URLs will be processed as links, any other content will be summarized as text."
                      className="w-full p-2 border rounded text-sm min-h-[80px]"
                      value={pasteInput}
                      onChange={handlePasteInputChange}
                      onPaste={() => {
                        // Use setTimeout to ensure the paste event completes
                        setTimeout(() => {
                          if (pasteInput.trim()) {
                            processUserInput();
                          }
                        }, 50);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          processUserInput();
                        }
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Press Ctrl+Enter to process</span>
                      <button
                        onClick={processUserInput}
                        disabled={!pasteInput.trim()}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                      >
                        Get Summary
                      </button>
                    </div>
                  </div>
                )}
              </div>
                
              {/* Links panel header with close button */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Extracted Links ({extractedLinks.length})</h3>
                <button
                  onClick={toggleSidebar}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Hide links panel"
                >
                  <X size={16} className="text-gray-600" />
                </button>
              </div>
              {extractedLinks.length === 0 ? (
                <p className="text-gray-500 text-sm">No links found in this email.</p>
              ) : (
                <div className="space-y-2">
                  {extractedLinks.map((link, index) => (
                    <div 
                      key={index} 
                      className="border rounded p-2"
                      onMouseEnter={() => handleLinkHover(link.url)}
                      onMouseLeave={() => handleLinkHover(null)}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => handleLinkClick(link)}
                          className="flex-1 text-left hover:bg-blue-50 p-1 rounded transition-colors cursor-pointer"
                        >
                          <div className="text-sm text-blue-600 hover:text-blue-800 break-all font-medium flex items-center">
                            <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center mr-1 text-xs">
                              AI
                            </span>
                            {/* Always show the domain as the main identifier */}
                            {link.domain}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 break-all">
                            {/* Show the link title/text if available and meaningful, otherwise show a descriptive text */}
                            {link.text && link.text !== link.url && link.text.trim() !== '' 
                              ? link.text 
                              : `Link to ${link.domain}`}
                          </div>
                        </button>
                        <button
                          onClick={() => handleOpenRegexChecker(link.url)}
                          className="p-1 text-purple-400 hover:text-purple-600"
                          title="Add URL filter pattern"
                        >
                          <Filter size={14} />
                        </button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Open in new tab"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      
                      {linkSummaries.has(link.url) && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          {linkSummaries.get(link.url)?.loading && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Loader2 size={14} className="animate-spin" />
                              Generating summary...
                            </div>
                          )}
                          {linkSummaries.get(link.url)?.error && (
                            <div className="text-red-600">
                              Error: {linkSummaries.get(link.url)?.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
            )}
          </div>

          {/* Bottom row: AI Summary - Full width */}
          <div className={`border-t bg-gray-50 ${
            activeSummaryUrls.length > 0 
              ? (isSummaryVisible ? 'flex-1 min-h-0 overflow-y-auto' : 'h-auto flex-shrink-0')
              : 'h-[50px] flex-shrink-0'
          }`}>
            {activeSummaryUrls.length > 0 ? (
              <div className={`${isSummaryVisible ? 'p-4 h-full' : 'p-2'} flex flex-col`}>
                {/* Tabs and Toggle Button */}
                <div className="flex items-center justify-between mb-3">
                  {/* Tabs */}
                  <div className={`flex gap-1 overflow-x-auto flex-nowrap ${activeSummaryUrls.length > 1 ? 'border-b flex-1' : 'flex-1'}`}>
                    {activeSummaryUrls.length > 1 ? (
                      activeSummaryUrls.map((url) => {
                        const summary = linkSummaries.get(url);
                        
                        // Handle special tabs differently
                        const isEmailTab = url.startsWith('email:');
                        const isTextTab = url.startsWith('text://');
                        let displayUrl, domain;
                        
                        if (isEmailTab) {
                          displayUrl = 'Email Summary';
                          domain = 'Email Summary';
                        } else if (isTextTab) {
                          displayUrl = 'Text Summary';
                          domain = 'Pasted Text';
                        } else {
                          displayUrl = summary?.finalUrl || url;
                          try {
                            domain = summary?.finalUrl ? new URL(summary.finalUrl).hostname : new URL(url).hostname;
                          } catch {
                            domain = url;
                          }
                        }
                        
                        return (
                          <button
                            key={url}
                            onClick={() => handleTabSwitch(url)}
                            className={`px-3 py-2 text-sm rounded-t-lg border-b-2 transition-all duration-300 flex items-center gap-2 max-w-[200px] flex-shrink-0 ${
                              summary?.error 
                                ? 'border-red-400 bg-red-100 text-red-800 hover:bg-red-200 shadow-sm animate-pulse' // Enhanced error state styling
                                : currentTabUrl === url
                                  ? 'border-blue-500 bg-white text-blue-700'
                                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                            title={summary?.error ? `Error: ${summary.error}` : displayUrl}
                          >
                            {summary?.loading && (
                              <Loader2 size={12} className="animate-spin flex-shrink-0" />
                            )}
                            {summary?.error && (
                              <AlertCircle size={14} className="flex-shrink-0 text-red-700 animate-pulse" />
                            )}
                            {isEmailTab && !summary?.error && <Mail size={12} className="flex-shrink-0" />}
                            <span className="truncate">{domain}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseSummary(url);
                              }}
                              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer"
                              title="Close this tab"
                            >
                              <X size={12} />
                            </span>
                          </button>
                        );
                      })
                    ) : activeSummary ? (
                      // Single tab display
                      <div className="text-sm text-gray-700 font-medium">
                        {activeSummary.url.startsWith('email:') ? 'Email Summary' :
                         activeSummary.url.startsWith('text://') ? 'Pasted Text Summary' :
                         (activeSummary.finalUrl ? new URL(activeSummary.finalUrl).hostname : new URL(activeSummary.url).hostname)}
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Toggle Button */}
                  <button
                    onClick={toggleSummaryPanel}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 ml-2"
                    title={isSummaryVisible ? 'Hide summary content' : 'Show summary content'}
                  >
                    {isSummaryVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>

                {/* Summary Content */}
                {activeSummary && isSummaryVisible && (
                  <div className="flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                        {activeSummary.url.startsWith('email:') ? (
                          <>
                            <Mail size={14} />
                            <span className="truncate">Email Summary</span>
                          </>
                        ) : activeSummary.url.startsWith('text://') ? (
                          <>
                            <FileText size={14} />
                            <span className="truncate">Pasted Text Summary</span>
                          </>
                        ) : (
                          <>
                            <span className="truncate">{activeSummary.finalUrl ? new URL(activeSummary.finalUrl).hostname : new URL(activeSummary.url).hostname}</span>
                            <button
                              onClick={() => window.open(activeSummary.finalUrl || activeSummary.url, '_blank')}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex-shrink-0"
                              title="Open in new tab"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </>
                        )}
                      </h3>
                      {activeSummaryUrls.length === 1 && (
                        <button
                          onClick={() => handleCloseSummary()}
                          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                          title="Close summary and focus on email"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                
                {activeSummary.loading && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 size={16} className="animate-spin" />
                    Generating summary with Ollama ({currentModel.quick})...
                  </div>
                )}
                
                {activeSummary.error && (
                  <div className="text-red-600 bg-red-50 p-3 rounded">
                    <strong>Error:</strong> {activeSummary.error}
                  </div>
                )}
                
                {activeSummary.summary && (
                  <div className="prose max-w-none">
                    <ReactMarkdown 
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                        {activeSummary.summary.includes('</think>')
                        ? activeSummary.summary.split('</think>')[1]
                        : activeSummary.summary}
                    </ReactMarkdown>
                    
                    {/* Action buttons */}
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-3 flex-wrap">
                      {/* Improve Summary Button - show only if upgrade is available */}
                      {activeSummary.canUpgrade && activeSummary.modelUsed === 'short' && (
                        <button
                          onClick={async () => {
                            try {
                              // Get original content from storage
                              const storedTab = await tabSummaryStorage.getTab(activeSummary.url);
                              const originalContent = storedTab?.content || '';
                              if (originalContent) {
                                await handleImproveSummary(activeSummary.url, originalContent);
                              } else {
                                console.error('No original content found for improvement');
                              }
                            } catch (error) {
                              console.error('Failed to improve summary:', error);
                            }
                          }}
                          disabled={activeSummary.loading}
                          className="inline-flex items-center gap-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 py-1 px-2 rounded-full transition-colors disabled:opacity-50"
                        >
                          {activeSummary.loading ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Improving...</span>
                            </>
                          ) : (
                            <>
                              <span>🔄</span>
                              <span>Improve Summary</span>
                            </>
                          )}
                        </button>
                      )}
                      
                      {/* Model indicator */}
                      {activeSummary.modelUsed && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {activeSummary.modelUsed === 'short' ? 'Quick Summary' : 'Detailed Summary'}
                        </span>
                      )}
                      
                      {/* Flash Cards Button */}
                      <button
                        onClick={() => generateFlashCards(
                          activeSummary.summary,
                          activeSummary.url.startsWith('email:') ? 'email' : 'link',
                          activeSummary.url,
                          activeSummary.url.startsWith('email:') ? undefined : (activeSummary.finalUrl || activeSummary.url)
                        )}
                        disabled={isGeneratingFlashCards === activeSummary.url}
                        className="inline-flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 py-1 px-2 rounded-full transition-colors disabled:opacity-50"
                      >
                        {isGeneratingFlashCards === activeSummary.url ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Creating Flash Cards...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen size={12} />
                            <span>Create Flash Cards</span>
                          </>
                        )}
                      </button>
                      {flashCardsError && isGeneratingFlashCards === null && (
                        <div className="mt-2 text-xs text-red-600">
                          {flashCardsError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 flex items-center h-full">
                <p className="text-gray-500 text-sm">
                  {activeSummaryUrls.length > 0 && !isSummaryVisible 
                    ? "Summary hidden - click the arrow button to show content"
                    : "Click on a link above to generate an AI summary"
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Email?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this email? It will be moved to trash.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Press <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> to delete or <kbd className="bg-gray-100 px-1 rounded">Esc</kbd> to cancel
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmail}
                disabled={isDeletingEmail}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingEmail ? (
                  <>
                    <Loader2 size={16} className="animate-spin inline mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Email'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mark Email as Read?</h3>
            <p className="text-gray-600 mb-6">
              This email hasn't been marked as read yet. Would you like to mark it as read before continuing?
                                             </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueWithoutMarking}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Continue Without Marking
              </button>
              <button
                onClick={handleConfirmMarkAsRead}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mark as Read & Continue
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      
      {/* Deep Analysis Sidebar */}
      <DeepAnalysisSidebar
        isVisible={showDeepAnalysisSidebar}
        onToggle={toggleDeepAnalysisSidebar}
        className="fixed top-0 right-0 z-50"
      />
      
      {/* Flash Cards Modal */}
      <FlashCardsModal
        isOpen={isFlashCardsModalOpen}
        onClose={() => setIsFlashCardsModalOpen(false)}
        flashCards={flashCards}
        onSave={handleSaveFlashCards}
        onDelete={handleDeleteFlashCard}
        title="Generated Flash Cards"
      />
      
      {/* Regex Checker Modal */}
      <RegexChecker
        isOpen={showRegexChecker}
        onClose={handleCloseRegexChecker}
        initialUrl={regexCheckerUrl}
        onPatternAdded={handleRegexPatternAdded}
      />
    </>
  );
};