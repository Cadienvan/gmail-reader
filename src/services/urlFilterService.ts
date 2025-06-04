import type { UrlFilterPattern } from '../types';

interface UrlFilterConfig {
  patterns: UrlFilterPattern[];
  enabled: boolean;
}

class UrlFilterService {
  private storageKey = 'gmail-reader-url-filters';
  private config: UrlFilterConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): UrlFilterConfig {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          patterns: parsed.patterns || [],
          enabled: parsed.enabled !== false // Default to true
        };
      }
    } catch (error) {
      console.error('Failed to load URL filter config:', error);
    }

    // Return default config
    return {
      patterns: [
        {
          id: '1',
          name: 'Unsubscribe Links',
          pattern: '.*/unsubscribe.*',
          description: 'Filter out unsubscribe links',
          enabled: true,
          createdAt: new Date(),
          lastModified: new Date()
        },
        {
          id: '2',
          name: 'Tracking Pixels',
          pattern: '.*\\.(gif|png)\\?.*utm_.*',
          description: 'Filter out tracking pixels and UTM parameters',
          enabled: true,
          createdAt: new Date(),
          lastModified: new Date()
        }
      ],
      enabled: true
    };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save URL filter config:', error);
    }
  }

  /**
   * Check if a URL should be filtered out
   */
  shouldFilterUrl(url: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    return this.config.patterns.some(pattern => {
      if (!pattern.enabled) {
        return false;
      }

      try {
        const regex = new RegExp(pattern.pattern, 'i');
        return regex.test(url);
      } catch (error) {
        console.warn(`Invalid regex pattern "${pattern.pattern}":`, error);
        return false;
      }
    });
  }

  /**
   * Test a URL against a specific pattern
   */
  testPattern(pattern: string, url: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(url);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate a regex pattern
   */
  validatePattern(pattern: string): { isValid: boolean; error?: string } {
    try {
      new RegExp(pattern);
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Invalid regex pattern' 
      };
    }
  }

  /**
   * Get all filter patterns
   */
  getPatterns(): UrlFilterPattern[] {
    return [...this.config.patterns];
  }

  /**
   * Add a new filter pattern
   */
  addPattern(pattern: Omit<UrlFilterPattern, 'id' | 'createdAt' | 'lastModified'>): UrlFilterPattern {
    const newPattern: UrlFilterPattern = {
      ...pattern,
      id: Date.now().toString(),
      createdAt: new Date(),
      lastModified: new Date()
    };

    this.config.patterns.push(newPattern);
    this.saveConfig();
    return newPattern;
  }

  /**
   * Update an existing filter pattern
   */
  updatePattern(id: string, updates: Partial<Omit<UrlFilterPattern, 'id' | 'createdAt'>>): boolean {
    const index = this.config.patterns.findIndex(p => p.id === id);
    if (index === -1) {
      return false;
    }

    this.config.patterns[index] = {
      ...this.config.patterns[index],
      ...updates,
      lastModified: new Date()
    };

    this.saveConfig();
    return true;
  }

  /**
   * Delete a filter pattern
   */
  deletePattern(id: string): boolean {
    const initialLength = this.config.patterns.length;
    this.config.patterns = this.config.patterns.filter(p => p.id !== id);
    
    if (this.config.patterns.length !== initialLength) {
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Enable or disable URL filtering globally
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  /**
   * Check if URL filtering is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get configuration
   */
  getConfig(): UrlFilterConfig {
    return { ...this.config };
  }

  /**
   * Reset to default patterns
   */
  resetToDefaults(): void {
    this.config = {
      patterns: [
        {
          id: '1',
          name: 'Unsubscribe Links',
          pattern: '.*/unsubscribe.*',
          description: 'Filter out unsubscribe links',
          enabled: true,
          createdAt: new Date(),
          lastModified: new Date()
        },
        {
          id: '2',
          name: 'Tracking Pixels',
          pattern: '.*\\.(gif|png)\\?.*utm_.*',
          description: 'Filter out tracking pixels and UTM parameters',
          enabled: true,
          createdAt: new Date(),
          lastModified: new Date()
        }
      ],
      enabled: true
    };
    this.saveConfig();
  }

  /**
   * Import patterns from an array
   */
  importPatterns(patterns: Omit<UrlFilterPattern, 'id' | 'createdAt' | 'lastModified'>[]): void {
    const newPatterns = patterns.map(pattern => ({
      ...pattern,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      lastModified: new Date()
    }));

    this.config.patterns.push(...newPatterns);
    this.saveConfig();
  }

  /**
   * Export patterns for backup/sharing
   */
  exportPatterns(): Omit<UrlFilterPattern, 'id' | 'createdAt' | 'lastModified'>[] {
    return this.config.patterns.map(({ id, createdAt, lastModified, ...pattern }) => pattern);
  }
}

export const urlFilterService = new UrlFilterService();