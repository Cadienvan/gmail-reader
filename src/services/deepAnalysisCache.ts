import type { QualityAssessmentResult } from '../types';

interface CacheStats {
  totalResults: number;
  highQualityCount: number;
  lastUpdated: Date | null;
  cacheSize: number; // in bytes
}

class DeepAnalysisCacheService {
  private readonly CACHE_KEY = 'deep-analysis-cache';
  private readonly METADATA_KEY = 'deep-analysis-metadata';
  private cache: Map<string, QualityAssessmentResult> = new Map();
  private isLoaded = false;

  constructor() {
    this.loadCache();
  }

  /**
   * Load cache from localStorage
   */
  private loadCache(): void {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.cache = new Map(Object.entries(parsed));
      }
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load deep analysis cache:', error);
      this.cache = new Map();
      this.isLoaded = true;
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCache(): void {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
      
      // Update metadata
      this.updateMetadata();
    } catch (error) {
      console.error('Failed to save deep analysis cache:', error);
    }
  }

  /**
   * Update cache metadata
   */
  private updateMetadata(): void {
    try {
      const metadata = {
        totalResults: this.cache.size,
        highQualityCount: Array.from(this.cache.values()).filter(r => r.isHighQuality).length,
        lastUpdated: new Date().toISOString(),
        cacheSize: new Blob([localStorage.getItem(this.CACHE_KEY) || '']).size
      };
      
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to update cache metadata:', error);
    }
  }

  /**
   * Save a quality assessment result to cache
   */
  saveResult(result: QualityAssessmentResult): void {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    this.cache.set(result.emailId, result);
    this.saveCache();
  }

  /**
   * Save multiple results to cache (batch operation)
   */
  saveResults(results: QualityAssessmentResult[]): void {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    for (const result of results) {
      this.cache.set(result.emailId, result);
    }
    
    this.saveCache();
  }

  /**
   * Get a quality assessment result from cache
   */
  getResult(emailId: string): QualityAssessmentResult | null {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    return this.cache.get(emailId) || null;
  }

  /**
   * Check if an email has a cached result
   */
  hasResult(emailId: string): boolean {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    return this.cache.has(emailId);
  }

  /**
   * Get all cached results
   */
  getAllResults(): QualityAssessmentResult[] {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    return Array.from(this.cache.values());
  }

  /**
   * Get high quality results only
   */
  getHighQualityResults(): QualityAssessmentResult[] {
    return this.getAllResults().filter(result => result.isHighQuality);
  }

  /**
   * Get results with links
   */
  getResultsWithLinks(): QualityAssessmentResult[] {
    return this.getAllResults().filter(result => result.hasLinks);
  }

  /**
   * Get results by content type
   */
  getResultsByContentType(contentType: 'full-email' | 'links-only' | 'mixed'): QualityAssessmentResult[] {
    return this.getAllResults().filter(result => result.contentType === contentType);
  }

  /**
   * Get results with quality score above threshold
   */
  getResultsByQualityThreshold(threshold: number): QualityAssessmentResult[] {
    return this.getAllResults().filter(result => result.qualityScore >= threshold);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    if (!this.isLoaded) {
      this.loadCache();
    }

    const results = this.getAllResults();
    const highQualityCount = results.filter(r => r.isHighQuality).length;
    
    // Calculate cache size
    let cacheSize = 0;
    try {
      const cacheData = localStorage.getItem(this.CACHE_KEY);
      if (cacheData) {
        cacheSize = new Blob([cacheData]).size;
      }
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
    }

    // Get last updated from metadata or calculate from results
    let lastUpdated: Date | null = null;
    try {
      const metadata = localStorage.getItem(this.METADATA_KEY);
      if (metadata) {
        const parsed = JSON.parse(metadata);
        lastUpdated = new Date(parsed.lastUpdated);
      } else if (results.length > 0) {
        // Fallback to latest processedAt timestamp
        const latestTimestamp = Math.max(...results.map(r => r.processedAt));
        lastUpdated = new Date(latestTimestamp);
      }
    } catch (error) {
      console.error('Failed to get last updated timestamp:', error);
    }

    return {
      totalResults: this.cache.size,
      highQualityCount,
      lastUpdated,
      cacheSize
    };
  }

  /**
   * Check if an email is marked as high quality
   */
  isEmailHighQuality(emailId: string): boolean {
    const result = this.getResult(emailId);
    return result?.isHighQuality || false;
  }

  /**
   * Get quality score for an email
   */
  getEmailQualityScore(emailId: string): number | null {
    const result = this.getResult(emailId);
    return result?.qualityScore ?? null;
  }

  /**
   * Get diversity score for an email
   */
  getEmailDiversityScore(emailId: string): number | null {
    const result = this.getResult(emailId);
    return result?.diversityScore ?? null;
  }

  /**
   * Remove a result from cache
   */
  removeResult(emailId: string): boolean {
    if (!this.isLoaded) {
      this.loadCache();
    }
    
    const existed = this.cache.delete(emailId);
    if (existed) {
      this.saveCache();
    }
    return existed;
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.METADATA_KEY);
  }

  /**
   * Remove results older than specified days
   */
  clearOldResults(daysOld: number = 30): number {
    if (!this.isLoaded) {
      this.loadCache();
    }

    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const initialSize = this.cache.size;
    
    for (const [emailId, result] of this.cache.entries()) {
      if (result.processedAt < cutoffTime) {
        this.cache.delete(emailId);
      }
    }
    
    const removedCount = initialSize - this.cache.size;
    
    if (removedCount > 0) {
      this.saveCache();
    }
    
    return removedCount;
  }

  /**
   * Get detailed statistics for UI display
   */
  getDetailedStats(): {
    totalResults: number;
    highQualityCount: number;
    resultsWithLinks: number;
    averageQualityScore: number;
    averageDiversityScore: number;
    contentTypeBreakdown: {
      fullEmail: number;
      linksOnly: number;
      mixed: number;
    };
    lastUpdated: Date | null;
    cacheSize: number;
    cacheSizeFormatted: string;
  } {
    const stats = this.getStats();
    const results = this.getAllResults();
    
    const resultsWithLinks = results.filter(r => r.hasLinks).length;
    const averageQualityScore = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0;
    const averageDiversityScore = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.diversityScore, 0) / results.length : 0;
    
    const contentTypeBreakdown = {
      fullEmail: results.filter(r => r.contentType === 'full-email').length,
      linksOnly: results.filter(r => r.contentType === 'links-only').length,
      mixed: results.filter(r => r.contentType === 'mixed').length
    };

    // Format cache size
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      ...stats,
      resultsWithLinks,
      averageQualityScore,
      averageDiversityScore,
      contentTypeBreakdown,
      cacheSizeFormatted: formatBytes(stats.cacheSize)
    };
  }
}

export const deepAnalysisCache = new DeepAnalysisCacheService();
