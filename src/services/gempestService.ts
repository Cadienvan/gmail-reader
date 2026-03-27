import { gmailService } from './gmailService';
import { linkService } from './linkService';
import { tabSummaryStorage } from './tabSummaryStorage';
import { memoryService } from './memoryService';
import type { ParsedEmail, LinkSummary } from '../types';

export type GeminiModel = string;

const MODELS_CACHE_KEY = 'gemini_models_cache';
const MODELS_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 1 month

export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const cached = localStorage.getItem(MODELS_CACHE_KEY);
  if (cached) {
    const { models, timestamp } = JSON.parse(cached) as { models: string[]; timestamp: number };
    if (Date.now() - timestamp < MODELS_CACHE_TTL) {
      return models;
    }
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`);

  const data = await response.json();
  const models: string[] = ((data.models ?? []) as Array<{ name: string; supportedGenerationMethods?: string[] }>)
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));

  localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ models, timestamp: Date.now() }));
  return models;
}

export interface GempestConfig {
  apiKey: string;
  classificationModel: GeminiModel;
  emailSummaryModel: GeminiModel;
  linkSummaryModel: GeminiModel;
  newsletterTypePrompt: string;
  emailSummaryPrompt: string;
  linkFilterPrompt: string;
  linkSummaryPrompt: string;
  postAction: 'mark_read' | 'delete' | 'none';
  delayBetweenEmails: number; // seconds
  memoryEnabled: boolean;
  memoryPhraseGeneratorPrompt: string;
}

const DEFAULT_CONFIG: GempestConfig = {
  apiKey: '',
  classificationModel: 'gemini-2.5-flash',
  emailSummaryModel: 'gemini-2.5-flash',
  linkSummaryModel: 'gemini-2.5-flash',
  newsletterTypePrompt: 'Determine the type of the following email. If it is NOT a newsletter, reply with "OTHER". If it is a newsletter and contains mostly a full article, reply with "NL_FULL". If it is a newsletter but is mostly a list of links to articles, reply with "NL_LINK". Only reply with one of these three exact words.',
  emailSummaryPrompt: 'Summarize the following email content clearly and concisely:',
  linkFilterPrompt: 'Determine which of the given links is a valid URL, removing all the subscribe, unsubscribe, follow, online read, sponsorized urls and just keeping the real URLs. Reply ONLY with a JSON array of the URL strings to keep, e.g. ["https://...", "https://..."].',
  linkSummaryPrompt: 'Summarize the following article content clearly and concisely:',
  postAction: 'none',
  delayBetweenEmails: 0,
  memoryEnabled: false,
  memoryPhraseGeneratorPrompt: 'Based on the following summary, write a single concise phrase of 5 to 30 words that represents the core concept, methodology, or topic covered. This phrase will be used to flag content the user already knows well and wants to deprioritize in future reading. Reply with only the phrase, no punctuation at the end, no quotes, no explanation.'
};

class GempestService {
  private config: GempestConfig;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  public onProgress?: (status: string) => void;
  public onEmailIndexChange?: (index: number) => void;
  public onSummaryReady?: (url: string, summary: LinkSummary) => void;

  constructor() {
    const stored = localStorage.getItem('gempest_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old single-model config to per-task models
      if (parsed.model && !parsed.classificationModel) {
        parsed.classificationModel = parsed.model;
        parsed.emailSummaryModel = parsed.model;
        parsed.linkSummaryModel = parsed.model;
        delete parsed.model;
      }
      this.config = { ...DEFAULT_CONFIG, ...parsed };
    } else {
      this.config = DEFAULT_CONFIG;
    }
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
      const model = this.config.classificationModel || 'gemini-2.5-flash';
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

  async runPrompt(prompt: string, text: string, model?: GeminiModel, retries = 3): Promise<string> {
    if (!this.config.apiKey) throw new Error("Gemini API Key missing");
    
    // Quick truncate if too large
    const safeText = text.slice(0, 30000); 

    const useModel = model || this.config.classificationModel || 'gemini-2.5-flash';

    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${this.config.apiKey}`, {
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

      if (response.status === 429) {
        const data = await response.json().catch(() => null);
        const msg = data?.error?.message || 'Rate limit exceeded';
        if (attempt < retries) {
          this.updateProgress(`⚠️ 429 RESOURCE_EXHAUSTED: ${msg} — Retrying in 15s (${attempt}/${retries})...`);
          await this.delay(15000);
          continue;
        }
        this.updateProgress(`❌ 429 RESOURCE_EXHAUSTED after ${retries} retries. Stopping Gempest. Consider upgrading your API quota.`);
        this.stop();
        throw new Error(`429 RESOURCE_EXHAUSTED: ${msg}`);
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

  /**
   * Sends the full list of labeled links to Gemini and returns only the URLs
   * that pass the linkFilterPrompt. Falls back to returning all URLs on parse error.
   */
  private async filterLinks(links: Array<{ url: string; text: string }>, senderEmail: string): Promise<string[]> {
    if (links.length === 0) return [];
    const linkList = links.map((l, i) => `${i}. [${l.text || l.url}](${l.url})`).join('\n');
    const linkFilterPrompt = this.config.linkFilterPrompt.replace('[SENDER_EMAIL]', senderEmail);
    let raw = '';
    try {
      raw = await this.runPrompt(linkFilterPrompt, linkList, this.config.classificationModel);
      console.log('[Gempest] filterLinks raw response:', raw);
      // Extract JSON array from the response (may be wrapped in markdown code blocks)
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array found in: ' + raw.slice(0, 200));
      const parsed: unknown = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      if (parsed.length === 0) return [];
      // Model may return URL strings OR numeric indices
      if (typeof parsed[0] === 'number') {
        console.log('[Gempest] filterLinks: model returned indices', parsed);
        return (parsed as number[])
          .filter(n => Number.isInteger(n) && n >= 0 && n < links.length)
          .map(n => links[n].url);
      }
      // Model returned URL strings — trim whitespace on each
      const urls = (parsed as unknown[]).filter((u): u is string => typeof u === 'string').map(u => u.trim());
      console.log('[Gempest] filterLinks: model returned', urls.length, 'URLs');
      return urls;
    } catch (e) {
      console.warn('[Gempest] filterLinks parse error, keeping all links. Raw response:', raw, e);
      return links.map(l => l.url);
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
        const typeStr = await this.runPrompt(this.config.newsletterTypePrompt, email.body || email.snippet || "", this.config.classificationModel);
        const upperTypeStr = typeStr.toUpperCase();

        if (upperTypeStr.includes('OTHER') || (!upperTypeStr.includes('NL_FULL') && !upperTypeStr.includes('NL_LINK'))) {
            this.updateProgress(`Skipped (Not a newsletter): ${email.subject}`);
            continue;
        }

        const isFullText = upperTypeStr.includes('NL_FULL');

        if (isFullText) {
            this.updateProgress(`Summarizing Full Text: ${email.subject}`);
            const reductiveMemory = this.config.memoryEnabled ? memoryService.getFormattedList('reductive') : '';
            const reinforcingMemory = this.config.memoryEnabled ? memoryService.getFormattedList('reinforcing') : '';
            const emailPrompt = this.config.emailSummaryPrompt
              .replace('[MEMORY_LIST]', reductiveMemory)
              .replace('[REDUCTIVE_MEMORY]', reductiveMemory)
              .replace('[REINFORCING_MEMORY]', reinforcingMemory)
              .replace('[SENDER_EMAIL]', email.from);
            const summary = await this.runPrompt(emailPrompt, email.body || email.snippet || "", this.config.emailSummaryModel);
            
            if (summary.trim().toUpperCase().includes('[CLOSE]')) {
              this.updateProgress(`Skipped (low value): ${email.subject}`);
            } else {
              const emailTabId = `email-${email.id}`;
              const emailTabSummary: LinkSummary = {
                url: emailTabId,
                summary: summary,
                loading: false,
                modelUsed: 'short'
              };
              if (this.config.memoryEnabled) {
                try {
                  this.updateProgress(`Generating memory phrase for: ${email.subject}`);
                  const phrase = await this.runPrompt(this.config.memoryPhraseGeneratorPrompt, summary, this.config.emailSummaryModel);
                  if (phrase) emailTabSummary.pendingMemoryPhrase = phrase;
                  console.log('[Gempest] Memory phrase generated:', phrase);
                } catch (e) {
                  console.warn('[Gempest] Memory phrase generation failed, continuing.', e);
                }
              }
              await tabSummaryStorage.saveLinkSummary(emailTabId, emailTabSummary, email.body, email.subject);
              if (this.onSummaryReady) this.onSummaryReady(emailTabId, emailTabSummary);
              this.updateProgress(`Done summarizing full text: ${email.subject}`);
            }
        } else {
            this.updateProgress(`Extracting Links for: ${email.subject}`);
            // Extract links
            const links = email.htmlBody 
              ? linkService.extractLinksFromHTML(email.htmlBody) 
              : linkService.extractLinksFromText(email.body || email.snippet || "");

            if (links.length === 0) {
                 this.updateProgress(`No links found in: ${email.subject}`);
            } else {
                // Build label lookup from original extracted links
                const urlToText = new Map(links.map(l => [l.url.trim(), l.text]));

                // Send all non-image links to Gemini for filtering
                const linksToFilter = links
                  .filter(l => !l.url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)/i))
                  .map(l => ({ url: l.url, text: l.text }));

                this.updateProgress(`Filtering ${linksToFilter.length} links via Gemini...`);
                const allowedUrls = await this.filterLinks(linksToFilter, email.from);
                this.updateProgress(`Kept ${allowedUrls.length} of ${linksToFilter.length} links after filtering.`);

                // Iterate over the URLs Gemini returned directly — avoids any URL normalisation mismatch
                for (const url of allowedUrls) {
                    if (!this.isRunning) break;
                    const label = urlToText.get(url.trim()) || url;
                    this.updateProgress(`Summarizing Link: ${label}`);
                    
                    try {
                        const contentObj = await linkService.fetchLinkContent(url);
                        if (contentObj && contentObj.content) {
                            const reductiveMemoryLink = this.config.memoryEnabled ? memoryService.getFormattedList('reductive') : '';
                            const reinforcingMemoryLink = this.config.memoryEnabled ? memoryService.getFormattedList('reinforcing') : '';
                            const linkPrompt = this.config.linkSummaryPrompt
                              .replace('[MEMORY_LIST]', reductiveMemoryLink)
                              .replace('[REDUCTIVE_MEMORY]', reductiveMemoryLink)
                              .replace('[REINFORCING_MEMORY]', reinforcingMemoryLink)
                              .replace('[SENDER_EMAIL]', email.from);
                            const linkSummaryText = await this.runPrompt(linkPrompt, contentObj.content, this.config.linkSummaryModel);
                            if (linkSummaryText.trim().toUpperCase().includes('[CLOSE]')) {
                                this.updateProgress(`Skipped (low value): ${label}`);
                            } else {
                                const linkSummaryData: LinkSummary = {
                                    url: url,
                                    finalUrl: contentObj.finalUrl,
                                    summary: linkSummaryText,
                                    loading: false
                                };
                                if (this.config.memoryEnabled) {
                                  try {
                                    this.updateProgress(`Generating memory phrase for: ${label}`);
                                    const phrase = await this.runPrompt(this.config.memoryPhraseGeneratorPrompt, linkSummaryText, this.config.linkSummaryModel);
                                    if (phrase) linkSummaryData.pendingMemoryPhrase = phrase;
                                    console.log('[Gempest] Memory phrase generated:', phrase);
                                  } catch (e) {
                                    console.warn('[Gempest] Memory phrase generation failed, continuing.', e);
                                  }
                                }
                                await tabSummaryStorage.saveLinkSummary(url, linkSummaryData, contentObj.content, label);
                                if (this.onSummaryReady) this.onSummaryReady(url, linkSummaryData);
                            }
                        } else {
                            console.warn('[Gempest] fetchLinkContent returned empty for', url);
                        }
                    } catch(e) {
                         console.error('[Gempest] Link extract/summary failed', url, e);
                    }
                }
            }
        }

        // Delay between emails
        if (this.config.delayBetweenEmails > 0 && i < emailsToProcess.length - 1) {
          this.updateProgress(`Waiting ${this.config.delayBetweenEmails}s before next email...`);
          await this.delay(this.config.delayBetweenEmails * 1000);
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