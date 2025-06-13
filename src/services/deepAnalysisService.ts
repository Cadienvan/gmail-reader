import type { 
  ParsedEmail, 
  DeepAnalysisProgress, 
  QualityAssessmentResult, 
  DeepAnalysisConfig,
  LinkSummary,
  EmailSender,
  SenderSelectionConfig
} from '../types';
import { gmailService } from './gmailService';
import { ollamaService } from './ollamaService';
import { linkService } from './linkService';
import { tabSummaryStorage } from './tabSummaryStorage';
import { deepAnalysisCache } from './deepAnalysisCache';

type DeepAnalysisEventCallback = (progress: DeepAnalysisProgress) => void;

class DeepAnalysisService {
  private progress: DeepAnalysisProgress = {
    totalEmails: 0,
    processedEmails: 0,
    currentPage: 1,
    qualityResults: [],
    isRunning: false,
    currentlyProcessingEmailId: undefined,
    currentlyProcessingEmailSubject: undefined
  };

  private config: DeepAnalysisConfig = {
    enabled: false,
    qualityThreshold: 80,
    diversityThreshold: 70,
    maxPagesToProcess: 10,
    autoCreateTabs: true
  };

  private callbacks: Set<DeepAnalysisEventCallback> = new Set();
  private abortController: AbortController | null = null;
  private readonly CONFIG_KEY = 'deep-analysis-config';
  private senderConfigs: SenderSelectionConfig[] = [];

  constructor() {
    this.loadConfig();
    this.loadCachedResults();
  }

  private loadConfig(): void {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load deep analysis config:', error);
    }
  }

  private loadCachedResults(): void {
    try {
      // Load cached results into current session for backwards compatibility
      const cachedResults = deepAnalysisCache.getAllResults();
      this.progress.qualityResults = [...cachedResults];
    } catch (error) {
      console.error('Failed to load cached analysis results:', error);
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save deep analysis config:', error);
    }
  }

  getConfig(): DeepAnalysisConfig {
    return { ...this.config };
  }

  setConfig(newConfig: Partial<DeepAnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.notifyCallbacks();
  }

  getProgress(): DeepAnalysisProgress {
    return { ...this.progress };
  }

  subscribe(callback: DeepAnalysisEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.getProgress());
      } catch (error) {
        console.error('Error in deep analysis callback:', error);
      }
    });
  }

  private updateProgress(updates: Partial<DeepAnalysisProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.notifyCallbacks();
  }

  async startDeepAnalysis(): Promise<void> {
    if (this.progress.isRunning) {
      throw new Error('Deep analysis is already running');
    }

    if (!gmailService.isAuthenticated()) {
      throw new Error('Gmail not authenticated');
    }

    if (!await ollamaService.isServiceAvailable()) {
      throw new Error('Ollama service not available');
    }

    this.abortController = new AbortController();
    
    this.updateProgress({
      isRunning: true,
      startTime: Date.now(),
      processedEmails: 0,
      currentPage: 1,
      qualityResults: [],
      error: undefined,
      endTime: undefined
    });

    try {
      await this.processAllEmails();
      
      this.updateProgress({
        isRunning: false,
        endTime: Date.now()
      });
    } catch (error) {
      this.updateProgress({
        isRunning: false,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      throw error;
    }
  }

  stopDeepAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.updateProgress({
      isRunning: false,
      currentlyProcessingEmailId: undefined,
      currentlyProcessingEmailSubject: undefined,
      endTime: Date.now()
    });
  }

  private async processAllEmails(): Promise<void> {
    let currentPageToken: string | undefined = undefined;
    let pageCount = 0;

    while (pageCount < this.config.maxPagesToProcess) {
      this.checkAborted();
      
      // Fetch emails for current page
      const emailsResult = await gmailService.getUnreadEmails(currentPageToken, 50, false);
      
      if (emailsResult.emails.length === 0) {
        console.log('No more emails to process');
        break;
      }

      // Filter emails by sender selection if configured
      const emailsToProcess = this.senderConfigs.length > 0 
        ? this.filterEmailsBySenders(emailsResult.emails)
        : emailsResult.emails;

      // Update total count on first page
      if (pageCount === 0) {
        // Estimate total based on first page - this is approximate
        const estimatedTotal = emailsResult.nextPageToken ? 
          emailsToProcess.length * this.config.maxPagesToProcess : 
          emailsToProcess.length;
        
        this.updateProgress({
          totalEmails: estimatedTotal
        });
      }

      this.updateProgress({ currentPage: pageCount + 1 });

      // Process each email in the current page
      for (const email of emailsToProcess) {
        this.checkAborted();
        await this.processEmail(email);
      }

      // Check if there are more pages
      if (!emailsResult.nextPageToken) {
        console.log('Reached end of emails');
        break;
      }

      currentPageToken = emailsResult.nextPageToken;
      pageCount++;
    }
  }

  private filterEmailsBySenders(emails: ParsedEmail[]): ParsedEmail[] {
    if (this.senderConfigs.length === 0) {
      return emails;
    }

    const selectedSenders = new Set(this.senderConfigs.map(config => config.email.toLowerCase()));
    
    return emails.filter(email => {
      const senderEmail = this.extractEmailFromSender(email.from).toLowerCase();
      return selectedSenders.has(senderEmail);
    });
  }

  private extractEmailFromSender(fromField: string): string {
    const nameMatch = fromField.match(/^(.+?)\s*<(.+)>$/);
    return nameMatch ? nameMatch[2] : fromField;
  }

  private getSenderContentType(email: ParsedEmail): 'full-email' | 'links-only' | 'mixed' {
    if (this.senderConfigs.length === 0) {
      return 'mixed'; // Default fallback
    }

    const senderEmail = this.extractEmailFromSender(email.from).toLowerCase();
    const senderConfig = this.senderConfigs.find(config => config.email.toLowerCase() === senderEmail);
    
    // Map user-friendly types to expected types
    const userContentType = senderConfig?.contentType || 'mixed';
    switch (userContentType) {
      case 'full-text':
        return 'full-email';
      case 'links-only':
        return 'links-only';
      case 'mixed':
      default:
        return 'mixed';
    }
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Deep analysis was cancelled');
    }
  }

  private async processEmail(email: ParsedEmail): Promise<void> {
    console.log(`Processing email: ${email.subject}`);
    
    // Set currently processing email
    this.updateProgress({
      currentlyProcessingEmailId: email.id,
      currentlyProcessingEmailSubject: email.subject
    });
    
    try {
      // Load email content
      const emailContent = await gmailService.getEmailContent(email.id);
      
      // Get user-provided content type for this sender, or use AI assessment as fallback
      const userProvidedContentType = this.getSenderContentType(email);
      
      // If user provided content type, use simplified assessment
      let assessment: any;
      let contentType: 'full-email' | 'links-only' | 'mixed';
      
      if (this.senderConfigs.length > 0) {
        // Use user-provided content type and simplified assessment
        contentType = userProvidedContentType;
        
        // Generate simplified quality assessment without content type detection
        assessment = await ollamaService.generateSimplifiedQualityAssessment(
          emailContent.body + (emailContent.htmlBody ? '\n\n' + emailContent.htmlBody : ''),
          contentType,
          this.abortController?.signal
        );
      } else {
        // Fall back to full AI assessment
        assessment = await ollamaService.generateQualityAssessmentWithContextClear(
          emailContent.body + (emailContent.htmlBody ? '\n\n' + emailContent.htmlBody : ''),
          this.abortController?.signal
        );
        contentType = assessment.contentType || 'mixed';
      }

      // Create quality result
      const qualityResult: QualityAssessmentResult = {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        hasLinks: assessment.hasLinks || false,
        contentType: contentType,
        qualityScore: assessment.qualityScore || 0,
        diversityScore: assessment.diversityScore || 0,
        reasoning: assessment.reasoning || 'No reasoning provided',
        isHighQuality: (assessment.qualityScore >= this.config.qualityThreshold) && 
                      (assessment.diversityScore >= this.config.diversityThreshold),
        processedAt: Date.now()
      };

      // Save to persistent cache
      deepAnalysisCache.saveResult(qualityResult);

      // Add to results
      this.progress.qualityResults.push(qualityResult);

      // If email meets quality criteria and auto-create tabs is enabled
      if (qualityResult.isHighQuality && this.config.autoCreateTabs) {
        await this.createTabsForHighQualityEmail(email, emailContent, qualityResult);
      }

      this.updateProgress({
        processedEmails: this.progress.processedEmails + 1,
        qualityResults: [...this.progress.qualityResults],
        currentlyProcessingEmailId: undefined, // Clear when done
        currentlyProcessingEmailSubject: undefined
      });

    } catch (error) {
      console.error(`Failed to process email ${email.id}:`, error);
      
      // Add failed result
      const failedResult: QualityAssessmentResult = {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        hasLinks: false,
        contentType: 'mixed',
        qualityScore: 0,
        diversityScore: 0,
        reasoning: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isHighQuality: false,
        processedAt: Date.now()
      };

      // Save failed result to cache as well
      deepAnalysisCache.saveResult(failedResult);

      this.progress.qualityResults.push(failedResult);
      
      this.updateProgress({
        processedEmails: this.progress.processedEmails + 1,
        qualityResults: [...this.progress.qualityResults],
        currentlyProcessingEmailId: undefined, // Clear when done
        currentlyProcessingEmailSubject: undefined
      });
    }
  }

  private async createTabsForHighQualityEmail(
    email: ParsedEmail, 
    emailContent: { body: string; htmlBody?: string },
    qualityResult: QualityAssessmentResult
  ): Promise<void> {
    console.log(`Creating tabs for high-quality email: ${email.subject}`);
    
    try {
      // Extract links from email content with enhanced detection
      const textLinks = linkService.extractLinksFromText(emailContent.body);
      
      // For HTML content, use the HTML directly
      // For plain text content, convert text URLs to HTML first, then extract
      let htmlLinks: ExtractedLink[] = [];
      if (emailContent.htmlBody) {
        htmlLinks = linkService.extractLinksFromHTML(emailContent.htmlBody);
      } else {
        // Convert plain text URLs to HTML and extract links
        const textAsHtml = linkService.convertTextUrlsToHTML(emailContent.body);
        htmlLinks = linkService.extractLinksFromHTML(textAsHtml);
      }
      
      // Combine and deduplicate links
      const allLinks = [...textLinks, ...htmlLinks];
      const uniqueLinks = allLinks.filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
      );

      console.log(`Found ${uniqueLinks.length} unique links in high-quality email`);
      
      // Respect performance configuration - check if queue mode is enabled
      const performanceConfig = ollamaService.getPerformanceConfiguration();
      
      // Process links with respect to performance configuration
      for (let i = 0; i < uniqueLinks.length; i++) {
        const link = uniqueLinks[i];
        
        try {
          // Fetch link content
          const { content, finalUrl } = await linkService.fetchLinkContent(link.url);
          
          // Generate summary using the service's queue if enabled
          const summary = await ollamaService.generateSummary(content, this.abortController?.signal);
          
          // Create LinkSummary object for tab creation
          const linkSummary: LinkSummary = {
            url: link.url,
            finalUrl,
            summary,
            loading: false,
            modelUsed: 'short' as const,
            canUpgrade: ollamaService.canUpgradeSummary()
          };
          
          // Save to persistent storage so it can be loaded when EmailModal opens
          await tabSummaryStorage.saveLinkSummary(
            link.url, 
            linkSummary, 
            content, 
            finalUrl ? new URL(finalUrl).hostname : new URL(link.url).hostname
          );
          
          console.log(`Created tab for link: ${link.url}`);
          
          // Add delay between processing if configured and queue mode is disabled
          if (!performanceConfig.enableQueueMode && performanceConfig.requestDelay > 0 && i < uniqueLinks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, performanceConfig.requestDelay));
          }
          
        } catch (error) {
          console.error(`Failed to create tab for link ${link.url}:`, error);
          
          // Save error state to storage
          const errorSummary: LinkSummary = {
            url: link.url,
            summary: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false
          };
          
          await tabSummaryStorage.saveLinkSummary(link.url, errorSummary);
        }
        
        // Check if analysis was cancelled
        this.checkAborted();
      }
      
      // Store metadata about this email being processed for high quality
      const emailMetadata = {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        processedAt: Date.now(),
        qualityScore: qualityResult.qualityScore,
        diversityScore: qualityResult.diversityScore,
        linksProcessed: uniqueLinks.length
      };
      
      // Save email metadata for later retrieval
      await tabSummaryStorage.saveEmailMetadata(email.id, emailMetadata);
      
    } catch (error) {
      console.error(`Failed to create tabs for email ${email.id}:`, error);
      throw error;
    }
  }

  getHighQualityResults(): QualityAssessmentResult[] {
    return this.progress.qualityResults.filter(result => result.isHighQuality);
  }

  getStatistics() {
    const results = this.progress.qualityResults;
    const highQuality = results.filter(r => r.isHighQuality);
    const withLinks = results.filter(r => r.hasLinks);
    
    return {
      totalProcessed: results.length,
      highQuality: highQuality.length,
      withLinks: withLinks.length,
      averageQuality: results.length > 0 ? 
        results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0,
      averageDiversity: results.length > 0 ? 
        results.reduce((sum, r) => sum + r.diversityScore, 0) / results.length : 0,
      contentTypes: {
        fullEmail: results.filter(r => r.contentType === 'full-email').length,
        linksOnly: results.filter(r => r.contentType === 'links-only').length,
        mixed: results.filter(r => r.contentType === 'mixed').length
      }
    };
  }

  clearResults(): void {
    this.updateProgress({
      totalEmails: 0,
      processedEmails: 0,
      currentPage: 1,
      qualityResults: [],
      currentlyProcessingEmailId: undefined,
      currentlyProcessingEmailSubject: undefined,
      startTime: undefined,
      endTime: undefined,
      error: undefined
    });
  }

  isEmailHighQuality(emailId: string): boolean {
    // First check current session results
    const sessionResult = this.progress.qualityResults.some(
      result => result.emailId === emailId && result.isHighQuality
    );
    
    if (sessionResult) {
      return true;
    }
    
    // Then check the persistent cache
    return deepAnalysisCache.isEmailHighQuality(emailId);
  }

  getEmailQualityResult(emailId: string): QualityAssessmentResult | undefined {
    // First check current session results
    const sessionResult = this.progress.qualityResults.find(result => result.emailId === emailId);
    
    if (sessionResult) {
      return sessionResult;
    }
    
    // Then check the persistent cache
    return deepAnalysisCache.getResult(emailId) || undefined;
  }

  async collectUniqueSenders(): Promise<EmailSender[]> {
    if (!gmailService.isAuthenticated()) {
      throw new Error('Gmail not authenticated');
    }

    const senderMap = new Map<string, EmailSender>();
    let currentPageToken: string | undefined = undefined;
    let pageCount = 0;

    // Collect senders from all pages up to the configured maximum
    while (pageCount < this.config.maxPagesToProcess) {
      try {
        const emailsResult = await gmailService.getUnreadEmails(currentPageToken, 50, false);
        
        if (emailsResult.emails.length === 0) {
          break;
        }

        // Process each email to extract sender information
        for (const email of emailsResult.emails) {
          const senderEmail = email.from.toLowerCase();
          const emailDate = new Date(email.date).getTime();
          
          if (senderMap.has(senderEmail)) {
            const existing = senderMap.get(senderEmail)!;
            existing.emailCount++;
            existing.lastEmailDate = Math.max(existing.lastEmailDate, emailDate);
            
            // Add subject to samples (keep max 5)
            if (existing.sampleSubjects.length < 5 && !existing.sampleSubjects.includes(email.subject)) {
              existing.sampleSubjects.push(email.subject);
            }
          } else {
            // Extract name from email address if available
            const nameMatch = email.from.match(/^(.+?)\s*<(.+)>$/);
            const name = nameMatch ? nameMatch[1].trim().replace(/['"]/g, '') : undefined;
            const emailOnly = nameMatch ? nameMatch[2] : email.from;

            senderMap.set(senderEmail, {
              email: emailOnly,
              name: name,
              emailCount: 1,
              lastEmailDate: emailDate,
              sampleSubjects: [email.subject]
            });
          }
        }

        if (!emailsResult.nextPageToken) {
          break;
        }

        currentPageToken = emailsResult.nextPageToken;
        pageCount++;
      } catch (error) {
        console.error(`Failed to collect senders from page ${pageCount + 1}:`, error);
        break;
      }
    }

    // Convert to array and sort by email count (descending)
    return Array.from(senderMap.values()).sort((a, b) => b.emailCount - a.emailCount);
  }

  setSenderConfigs(configs: SenderSelectionConfig[]): void {
    this.senderConfigs = [...configs];
  }

  async startDeepAnalysisWithSenders(senderConfigs: SenderSelectionConfig[]): Promise<void> {
    this.setSenderConfigs(senderConfigs);
    return this.startDeepAnalysis();
  }
}

export const deepAnalysisService = new DeepAnalysisService();
