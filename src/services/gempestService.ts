import { gmailService } from './gmailService';
import { linkService } from './linkService';
import { tabSummaryStorage } from './tabSummaryStorage';
import type { ParsedEmail } from '../types';

export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];

export interface GempestConfig {
  apiKey: string;
  model: GeminiModel;
  newsletterTypePrompt: string;
  emailSummaryPrompt: string;
  linkSummaryPrompt: string;
  postAction: 'mark_read' | 'delete' | 'none';
}

const DEFAULT_CONFIG: GempestConfig = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  newsletterTypePrompt: 'Determine the type of the following email. If it is NOT a newsletter, reply with "OTHER". If it is a newsletter and contains mostly a full article, reply with "NL_FULL". If it is a newsletter but is mostly a list of links to articles, reply with "NL_LINK". Only reply with one of these three exact words.',
  emailSummaryPrompt: 'Summarize the following email content clearly and concisely:',
  linkSummaryPrompt: 'Summarize the following article content clearly and concisely:',
  postAction: 'none'
};

class GempestService {
  private config: GempestConfig;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  public onProgress?: (status: string) => void;
  public onEmailIndexChange?: (index: number) => void;

  constructor() {
    const stored = localStorage.getItem('gempest_config');
    this.config = stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
  }

  saveConfig(config: GempestConfig) {
    this.config = config;
    localStorage.setItem('gempest_config', JSON.stringify(config));
  }

  getConfig(): GempestConfig {
    return this.config;
  }

  async testGemini(apiKey: string): Promise<boolean> {
    try {
      const model = this.config.model || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello" }] }]
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runPrompt(prompt: string, text: string, retries = 3): Promise<string> {
    if (!this.config.apiKey) throw new Error("Gemini API Key missing");
    
    // Quick truncate if too large
    const safeText = text.slice(0, 30000); 

    const model = this.config.model || 'gemini-2.5-flash';

    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\n${safeText}` }] }]
        }),
        signal: this.abortController?.signal
      });

      if (response.status === 503) {
        const data = await response.json().catch(() => null);
        const msg = data?.error?.message || 'Service temporarily unavailable';
        if (attempt < retries) {
          this.updateProgress(`⚠️ 503 UNAVAILABLE: ${msg} — Retrying in 10s (${attempt}/${retries})...`);
          await this.delay(10000);
          continue;
        }
        // Final attempt also 503 — stop Gempest
        this.updateProgress(`❌ 503 UNAVAILABLE after ${retries} retries. Stopping Gempest.`);
        this.stop();
        throw new Error(`503 UNAVAILABLE: ${msg}`);
      }

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }

    throw new Error('Unexpected: exhausted retries without returning');
  }

  stop() {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.updateProgress("Stopped.");
  }

  private updateProgress(msg: string) {
    if (this.onProgress) {
        this.onProgress(msg);
    }
  }

  async start(emailsToProcess: ParsedEmail[]) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      for (let i = 0; i < emailsToProcess.length; i++) {
        if (!this.isRunning) break;
        const email = emailsToProcess[i];

        // Notify UI which email we're on
        if (this.onEmailIndexChange) {
          this.onEmailIndexChange(i);
        }
        
        this.updateProgress(`[${i + 1}/${emailsToProcess.length}] Loading: ${email.subject}`);

        // Load full email content from Gmail API if not already loaded
        if (!email.body || email.body === '(Content will be loaded when opened)') {
          try {
            const content = await gmailService.getEmailContent(email.id);
            email.body = content.body;
            email.htmlBody = content.htmlBody;
          } catch (e) {
            console.error('Failed to load email content for', email.id, e);
            this.updateProgress(`⚠️ Failed to load content for: ${email.subject}, skipping.`);
            continue;
          }
        }

        this.updateProgress(`[${i + 1}/${emailsToProcess.length}] Classifying: ${email.subject}`);

        // 1. Determine email type (Newsletter full / Newsletter link list / Other)
        const typeStr = await this.runPrompt(this.config.newsletterTypePrompt, email.body || email.snippet || "");
        const upperTypeStr = typeStr.toUpperCase();

        if (upperTypeStr.includes('OTHER') || (!upperTypeStr.includes('NL_FULL') && !upperTypeStr.includes('NL_LINK'))) {
            this.updateProgress(`Skipped (Not a newsletter): ${email.subject}`);
            continue;
        }

        const isFullText = upperTypeStr.includes('NL_FULL');

        if (isFullText) {
            this.updateProgress(`Summarizing Full Text: ${email.subject}`);
            const summary = await this.runPrompt(this.config.emailSummaryPrompt, email.body || email.snippet || "");
            
            // Save to tabSummaryStorage
            const emailTabId = `email-${email.id}`;
            await tabSummaryStorage.saveLinkSummary(emailTabId, {
              url: emailTabId,
              summary: summary,
              loading: false,
              modelUsed: 'short'
            }, email.body, email.subject);
            
            this.updateProgress(`Done summarizing full text: ${email.subject}`);
        } else {
            this.updateProgress(`Extracting Links for: ${email.subject}`);
            // Extract links
            const links = email.htmlBody 
              ? linkService.extractLinksFromHTML(email.htmlBody) 
              : linkService.extractLinksFromText(email.body || email.snippet || "");

            if (links.length === 0) {
                 this.updateProgress(`No links found in: ${email.subject}`);
            } else {
                for (const link of links) {
                    if (!this.isRunning) break;
                    // Ignore unsubscribe or sponsored
                    const lowerText = link.text.toLowerCase();
                    const lowerUrl = link.url.toLowerCase();
                    if (lowerText.includes('unsubscribe') || lowerUrl.includes('unsubscribe') || lowerText.includes('sponsor')) {
                        continue;
                    }
                    this.updateProgress(`Summarizing Link: ${link.text || link.url}`);
                    
                    try {
                        const contentObj = await linkService.fetchLinkContent(link.url);
                        if (contentObj && contentObj.content) {
                            const linkSummary = await this.runPrompt(this.config.linkSummaryPrompt, contentObj.content);
                            await tabSummaryStorage.saveLinkSummary(link.url, {
                                url: link.url,
                                finalUrl: contentObj.finalUrl,
                                summary: linkSummary,
                                loading: false
                            }, contentObj.content, link.text);
                        }
                    } catch(e) {
                         console.error("Link extract/summary failed", e);
                    }
                }
            }
        }

        // Action
        if (this.config.postAction === 'mark_read') {
             this.updateProgress(`Marking as read: ${email.subject}`);
             await gmailService.markAsRead(email.id);
             email.isRead = true;
        } else if (this.config.postAction === 'delete') {
             this.updateProgress(`Deleting: ${email.subject}`);
             await gmailService.deleteEmail(email.id);
        }
      }
      this.updateProgress("Gempest completely finished.");
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.updateProgress("Aborted by user.");
      } else {
        console.error(error);
        this.updateProgress(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  isCurrentlyRunning() {
      return this.isRunning;
  }

  hasApiKey(): boolean {
      return !!this.config.apiKey;
  }
}

export const gempestService = new GempestService();