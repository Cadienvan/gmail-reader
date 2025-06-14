import type { ParsedEmail } from '../types';

interface CachedEmailData {
  emails: ParsedEmail[];
  timestamp: number;
  nextPageToken?: string;
}

interface CacheMetadata {
  lastFetch: number;
  totalCachedEmails: number;
  lastPageToken?: string;
}

class EmailCacheService {
  private readonly CACHE_KEY = 'gmail-email-cache';
  private readonly METADATA_KEY = 'gmail-cache-metadata';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_CACHED_EMAILS = 500; // Maximum number of emails to cache

  /**
   * Get cached emails if they exist and are still valid
   */
  getCachedEmails(pageToken?: string): { emails: ParsedEmail[], nextPageToken?: string } | null {
    try {
      const cacheKey = this.getCacheKey(pageToken);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const parsed: CachedEmailData = JSON.parse(cachedData);
      
      // Check if cache is still valid
      if (Date.now() - parsed.timestamp > this.CACHE_DURATION) {
        this.invalidateCache(pageToken);
        return null;
      }

      return {
        emails: parsed.emails,
        nextPageToken: parsed.nextPageToken
      };
    } catch (error) {
      console.error('Failed to get cached emails:', error);
      return null;
    }
  }

  /**
   * Cache emails with pagination info
   */
  cacheEmails(emails: ParsedEmail[], pageToken?: string, nextPageToken?: string): void {
    try {
      const cacheKey = this.getCacheKey(pageToken);
      const cacheData: CachedEmailData = {
        emails,
        timestamp: Date.now(),
        nextPageToken
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Update metadata
      this.updateCacheMetadata(emails.length, nextPageToken);
      
      // Clean up old cache entries if we have too many
      this.cleanupOldCache();
    } catch (error) {
      console.error('Failed to cache emails:', error);
    }
  }

  /**
   * Check if an email has real body content (not placeholder text)
   */
  private hasRealContent(email: ParsedEmail): boolean {
    return !!(email.body && 
              email.body !== '(Content will be loaded when opened)' && 
              email.body !== email.snippet &&
              email.body.trim().length > 0);
  }

  /**
   * Get cached email content only if it has real body content, otherwise return the email for metadata
   */
  getCachedEmailContentWithRealBody(emailId: string): ParsedEmail | null {
    const email = this.getCachedEmailContent(emailId);
    if (email && this.hasRealContent(email)) {
      return email;
    }
    return null;
  }

  /**
   * Check if a specific email is cached (for individual email content)
   */
  getCachedEmailContent(emailId: string): ParsedEmail | null {
    try {
      // Check all cached pages for this email
      const allCacheKeys = this.getAllCacheKeys();
      
      for (const cacheKey of allCacheKeys) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed: CachedEmailData = JSON.parse(cachedData);
          
          // Check if cache is still valid
          if (Date.now() - parsed.timestamp <= this.CACHE_DURATION) {
            const email = parsed.emails.find(e => e.id === emailId);
            if (email) {
              return email;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached email content:', error);
      return null;
    }
  }

  /**
   * Cache individual email content (useful when fetching full email details)
   */
  cacheEmailContent(email: ParsedEmail): void {
    try {
      // Update the email in existing cache if it exists
      const allCacheKeys = this.getAllCacheKeys();
      
      for (const cacheKey of allCacheKeys) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed: CachedEmailData = JSON.parse(cachedData);
          const emailIndex = parsed.emails.findIndex(e => e.id === email.id);
          
          if (emailIndex !== -1) {
            // Update the email with full content
            parsed.emails[emailIndex] = { ...parsed.emails[emailIndex], ...email };
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
            break;
          }
        }
      }
    } catch (error) {
      console.error('Failed to cache email content:', error);
    }
  }

  /**
   * Invalidate cache for a specific page or all cache
   */
  invalidateCache(pageToken?: string): void {
    try {
      if (pageToken) {
        const cacheKey = this.getCacheKey(pageToken);
        localStorage.removeItem(cacheKey);
        console.log('EmailCacheService: Cleared cache for page:', pageToken);
      } else {
        // Clear all email cache
        const allCacheKeys = this.getAllCacheKeys();
        console.log('EmailCacheService: Clearing all cache keys:', allCacheKeys.length, 'keys found');
        allCacheKeys.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(this.METADATA_KEY);
        console.log('EmailCacheService: All email cache and metadata cleared');
      }
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEmails: number, lastFetch: Date | null, isValid: boolean } {
    try {
      const metadata = this.getCacheMetadata();
      const isValid = metadata ? (Date.now() - metadata.lastFetch) <= this.CACHE_DURATION : false;
      
      return {
        totalEmails: metadata?.totalCachedEmails || 0,
        lastFetch: metadata ? new Date(metadata.lastFetch) : null,
        isValid
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalEmails: 0,
        lastFetch: null,
        isValid: false
      };
    }
  }

  /**
   * Force refresh cache (clear and mark for reload)
   */
  forceRefresh(): void {
    console.log('EmailCacheService: Force refresh initiated - clearing all cache');
    this.invalidateCache();
    console.log('EmailCacheService: All cache cleared successfully');
  }

  /**
   * Remove a specific email from cache (useful when email is deleted)
   */
  removeEmailFromCache(emailId: string): void {
    try {
      const allCacheKeys = this.getAllCacheKeys();
      let emailRemoved = false;
      
      for (const cacheKey of allCacheKeys) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed: CachedEmailData = JSON.parse(cachedData);
          
          // Check if cache is still valid
          if (Date.now() - parsed.timestamp <= this.CACHE_DURATION) {
            const emailIndex = parsed.emails.findIndex(e => e.id === emailId);
            if (emailIndex !== -1) {
              // Remove the email from the cache
              parsed.emails.splice(emailIndex, 1);
              localStorage.setItem(cacheKey, JSON.stringify(parsed));
              emailRemoved = true;
              console.log('Removed deleted email from cache:', emailId);
              
              // Update metadata count
              const metadata = this.getCacheMetadata();
              if (metadata) {
                metadata.totalCachedEmails = Math.max(0, metadata.totalCachedEmails - 1);
                localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
              }
              break;
            }
          }
        }
      }
      
      if (!emailRemoved) {
        console.log('Email not found in cache for removal:', emailId);
      }
    } catch (error) {
      console.error('Failed to remove email from cache:', error);
    }
  }

  /**
   * Get detailed cache statistics including content vs metadata counts
   */
  getDetailedCacheStats(): { 
    totalEmails: number, 
    emailsWithContent: number,
    emailsWithPlaceholder: number,
    lastFetch: Date | null, 
    isValid: boolean 
  } {
    try {
      const metadata = this.getCacheMetadata();
      const isValid = metadata ? (Date.now() - metadata.lastFetch) <= this.CACHE_DURATION : false;
      
      let totalEmails = 0;
      let emailsWithContent = 0;
      let emailsWithPlaceholder = 0;
      
      const allCacheKeys = this.getAllCacheKeys();
      
      for (const cacheKey of allCacheKeys) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed: CachedEmailData = JSON.parse(cachedData);
          
          // Check if cache is still valid
          if (Date.now() - parsed.timestamp <= this.CACHE_DURATION) {
            totalEmails += parsed.emails.length;
            
            for (const email of parsed.emails) {
              if (this.hasRealContent(email)) {
                emailsWithContent++;
              } else {
                emailsWithPlaceholder++;
              }
            }
          }
        }
      }
      
      return {
        totalEmails,
        emailsWithContent,
        emailsWithPlaceholder,
        lastFetch: metadata ? new Date(metadata.lastFetch) : null,
        isValid
      };
    } catch (error) {
      console.error('Failed to get detailed cache stats:', error);
      return {
        totalEmails: 0,
        emailsWithContent: 0,
        emailsWithPlaceholder: 0,
        lastFetch: null,
        isValid: false
      };
    }
  }

  // Private helper methods
  private getCacheKey(pageToken?: string): string {
    return pageToken ? `${this.CACHE_KEY}-${pageToken}` : `${this.CACHE_KEY}-first-page`;
  }

  private getAllCacheKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_KEY)) {
        keys.push(key);
      }
    }
    return keys;
  }

  private getCacheMetadata(): CacheMetadata | null {
    try {
      const metadata = localStorage.getItem(this.METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      return null;
    }
  }

  private updateCacheMetadata(newEmailsCount: number, nextPageToken?: string): void {
    try {
      const existing = this.getCacheMetadata();
      const metadata: CacheMetadata = {
        lastFetch: Date.now(),
        totalCachedEmails: (existing?.totalCachedEmails || 0) + newEmailsCount,
        lastPageToken: nextPageToken
      };
      
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to update cache metadata:', error);
    }
  }

  private cleanupOldCache(): void {
    try {
      const metadata = this.getCacheMetadata();
      if (metadata && metadata.totalCachedEmails > this.MAX_CACHED_EMAILS) {
        // Remove oldest cache entries
        const allCacheKeys = this.getAllCacheKeys();
        const cacheEntries = allCacheKeys.map(key => {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed: CachedEmailData = JSON.parse(data);
            return { key, timestamp: parsed.timestamp };
          }
          return null;
        }).filter(Boolean) as { key: string, timestamp: number }[];

        // Sort by timestamp (oldest first)
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

        // Remove oldest entries until we're under the limit
        let currentCount = metadata.totalCachedEmails;
        for (const entry of cacheEntries) {
          if (currentCount <= this.MAX_CACHED_EMAILS) break;
          
          const data = localStorage.getItem(entry.key);
          if (data) {
            const parsed: CachedEmailData = JSON.parse(data);
            currentCount -= parsed.emails.length;
            localStorage.removeItem(entry.key);
          }
        }

        // Update metadata
        metadata.totalCachedEmails = currentCount;
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
      }
    } catch (error) {
      console.error('Failed to cleanup old cache:', error);
    }
  }
}

export const emailCacheService = new EmailCacheService();
