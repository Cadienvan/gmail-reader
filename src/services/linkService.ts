import * as cheerio from 'cheerio';
import type { ExtractedLink } from '../types';

interface CacheEntry {
  content: string;
  finalUrl: string;
  timestamp: number;
}

class LinkService {
  private urlCache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  private showCorsLimitationMessage(url: string) {
    console.warn(`
🔒 CORS Limitation: Website "${new URL(url).hostname}" blocked browser access.
💡 Tip: If this link fails to load, try opening it directly in a new tab.
    `);
  }

  private getCachedContent(url: string): { content: string; finalUrl: string } | null {
    const cached = this.urlCache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📋 Using cached content for: ${url}`);
      return { content: cached.content, finalUrl: cached.finalUrl };
    }
    return null;
  }

  private setCachedContent(url: string, content: string, finalUrl: string) {
    this.urlCache.set(url, {
      content,
      finalUrl,
      timestamp: Date.now()
    });
    
    // Clean old cache entries periodically
    if (this.urlCache.size > 100) {
      this.cleanCache();
    }
  }

  private cleanCache() {
    const now = Date.now();
    for (const [url, entry] of this.urlCache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.urlCache.delete(url);
      }
    }
  }
  extractLinksFromText(text: string): ExtractedLink[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const matches = text.match(urlRegex) || [];
    
    return matches.map(url => {
      try {
        const urlObj = new URL(url);
        return {
          url: url,
          text: url,
          domain: urlObj.hostname
        };
      } catch (error) {
        return {
          url: url,
          text: url,
          domain: 'invalid-url'
        };
      }
    });
  }

  extractLinksFromHTML(html: string): ExtractedLink[] {
    try {
      const $ = cheerio.load(html);
      const links: ExtractedLink[] = [];

      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          try {
            const urlObj = new URL(href);
            links.push({
              url: href,
              text: text || href,
              domain: urlObj.hostname
            });
          } catch (error) {
            // Skip invalid URLs
          }
        }
      });

      return links;
    } catch (error) {
      console.error('Error extracting links from HTML:', error);
      return [];
    }
  }

  async fetchLinkContent(url: string): Promise<{ content: string; finalUrl: string }> {
    // Check cache first
    const cached = this.getCachedContent(url);
    if (cached) {
      return cached;
    }

    try {
      // Try direct fetch first (will work for CORS-enabled sites)
      const directResult = await this.tryDirectFetch(url);
      if (directResult) {
        // Cache successful result
        this.setCachedContent(url, directResult.content, directResult.finalUrl);
        return directResult;
      }
    } catch (error) {
      console.log('Direct fetch failed, trying CORS proxies...', error);
      this.showCorsLimitationMessage(url);
    }

    // Fallback to CORS proxy services
    const proxies = [
      {
        name: 'allorigins',
        getUrl: (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        timeout: 10000
      },
      {
        name: 'corsproxy.io',
        getUrl: (targetUrl: string) => `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        timeout: 10000
      },
      {
        name: 'cors-anywhere-backup',
        getUrl: (targetUrl: string) => `https://cors-anywhere.herokuapp.com/${targetUrl}`,
        timeout: 15000
      },
      {
        name: 'crossorigin.me',
        getUrl: (targetUrl: string) => `https://crossorigin.me/${targetUrl}`,
        timeout: 12000
      }
    ];

    for (const proxy of proxies) {
      try {
        console.log(`Trying ${proxy.name} proxy for: ${url}`);
        const result = await this.fetchViaProxy(url, proxy);
        if (result) {
          // Cache successful result
          this.setCachedContent(url, result.content, result.finalUrl);
          return result;
        }
      } catch (error) {
        console.log(`${proxy.name} proxy failed:`, error);
        continue;
      }
    }

    throw new Error(`Failed to fetch content from ${url}. All methods exhausted.`);
  }

  private async tryDirectFetch(url: string): Promise<{ content: string; finalUrl: string } | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let content = '';

      if (contentType.includes('text/html')) {
        const html = await response.text();
        content = this.extractTextFromHTML(html);
      } else if (contentType.includes('text/')) {
        content = await response.text();
      } else {
        content = `Content type: ${contentType}\nBinary content detected.`;
      }

      return {
        content,
        finalUrl: response.url || url
      };
    } catch (error) {
      console.error('Direct fetch failed:', error);
      return null;
    }
  }

  private async fetchViaProxy(url: string, proxy: { name: string; getUrl: (url: string) => string; timeout: number }): Promise<{ content: string; finalUrl: string } | null> {
    try {
      const proxyUrl = proxy.getUrl(url);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(proxy.timeout)
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const content = this.extractTextFromHTML(html);

      return {
        content,
        finalUrl: url // Proxy might not give us the final URL after redirects
      };
    } catch (error) {
      console.error(`Proxy ${proxy.name} failed:`, error);
      return null;
    }
  }

  private extractTextFromHTML(html: string): string {
    try {
      // Create a DOM parser to extract text content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      
      // Get text content and clean it up
      let text = doc.body?.textContent || doc.textContent || '';
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      return text;
    } catch (error) {
      console.error('Error extracting text from HTML:', error);
      return html; // Return original HTML if parsing fails
    }
  }


}

export const linkService = new LinkService();
