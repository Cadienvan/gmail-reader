import type { 
  ParsedEmail, 
  DeepAnalysisProgress, 
  QualityAssessmentResult, 
  DeepAnalysisConfig,
  LinkSummary
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

      // Update total count on first page
      if (pageCount === 0) {
        // Estimate total based on first page - this is approximate
        const estimatedTotal = emailsResult.nextPageToken ? 
          emailsResult.emails.length * this.config.maxPagesToProcess : 
          emailsResult.emails.length;
        
        this.updateProgress({
          totalEmails: estimatedTotal
        });
      }

      this.updateProgress({ currentPage: pageCount + 1 });

      // Process each email in the current page
      for (const email of emailsResult.emails) {
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
      
      // Classify content type and get quality assessment with context clearing
      const assessment = await ollamaService.generateQualityAssessmentWithContextClear(
        emailContent.body + (emailContent.htmlBody ? '\n\n' + emailContent.htmlBody : ''),
        this.abortController?.signal
      );

      // Create quality result
      const qualityResult: QualityAssessmentResult = {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        hasLinks: assessment.hasLinks || false,
        contentType: assessment.contentType || 'mixed',
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
      // Extract links from email content
      const textLinks = linkService.extractLinksFromText(emailContent.body);
      const htmlLinks = emailContent.htmlBody ? 
        linkService.extractLinksFromHTML(emailContent.htmlBody) : [];
      
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
}

export const deepAnalysisService = new DeepAnalysisService();
