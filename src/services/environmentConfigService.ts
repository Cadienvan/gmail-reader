export interface EnvironmentConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  ollamaBaseUrl: string;
  saveForLaterMode: boolean;
  gmailQuery: string;
  scoringEnabled: boolean;
  emailSummaryPoints: number;
  linkOpenPoints: number;
}

// Import email cache service for clearing cache when Gmail query changes
import { emailCacheService } from './emailCacheService';
import { deepAnalysisCache } from './deepAnalysisCache';

class EnvironmentConfigService {
  private readonly CONFIG_KEY = 'environment-configuration';
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Get current environment configuration
   */
  getConfiguration(): EnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Update environment configuration
   */
  setConfiguration(config: EnvironmentConfig): void {
    // Check if Gmail query has changed
    const gmailQueryChanged = this.config.gmailQuery !== config.gmailQuery;
    
    this.config = { ...config };
    this.saveConfiguration();
    
    // Clear email cache if Gmail query has changed
    if (gmailQueryChanged) {
      emailCacheService.forceRefresh();
      deepAnalysisCache.clearCache();
      console.log('Gmail query changed in environment config - email and analysis caches cleared');
    }
  }

  /**
   * Update specific configuration field
   */
  updateConfigField<K extends keyof EnvironmentConfig>(field: K, value: EnvironmentConfig[K]): void {
    // Check if Gmail query is being changed
    const gmailQueryChanged = field === 'gmailQuery' && this.config.gmailQuery !== value;
    
    this.config[field] = value;
    this.saveConfiguration();
    
    // Clear email cache if Gmail query has changed
    if (gmailQueryChanged) {
      emailCacheService.forceRefresh();
      deepAnalysisCache.clearCache();
      console.log('Gmail query changed via updateConfigField - email and analysis caches cleared');
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = this.getDefaultConfiguration();
    this.saveConfiguration();
  }

  /**
   * Check if configuration is complete (all required fields filled)
   */
  isConfigurationComplete(): boolean {
    return !!(
      this.config.googleClientId &&
      this.config.googleClientSecret &&
      this.config.googleRedirectUri &&
      this.config.ollamaBaseUrl
    );
  }

  /**
   * Get configuration for Google OAuth
   */
  getGoogleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
    return {
      clientId: this.config.googleClientId,
      clientSecret: this.config.googleClientSecret,
      redirectUri: this.config.googleRedirectUri
    };
  }

  /**
   * Get Ollama base URL
   */
  getOllamaBaseUrl(): string {
    return this.config.ollamaBaseUrl;
  }

  /**
   * Get save for later mode setting
   */
  getSaveForLaterMode(): boolean {
    return this.config.saveForLaterMode;
  }

  /**
   * Get Gmail query setting
   */
  getGmailQuery(): string {
    return this.config.gmailQuery;
  }

  /**
   * Get scoring configuration
   */
  getScoringConfig(): { enabled: boolean; emailSummaryPoints: number; linkOpenPoints: number } {
    return {
      enabled: this.config.scoringEnabled,
      emailSummaryPoints: this.config.emailSummaryPoints,
      linkOpenPoints: this.config.linkOpenPoints
    };
  }

  /**
   * Check if scoring is enabled
   */
  isScoringEnabled(): boolean {
    return this.config.scoringEnabled;
  }

  /**
   * Export configuration as JSON string
   */
  exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  importConfiguration(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson) as EnvironmentConfig;
      
      // Validate the imported configuration
      if (this.validateConfiguration(imported)) {
        this.config = imported;
        this.saveConfiguration();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  // Private methods
  private loadConfiguration(): EnvironmentConfig {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as EnvironmentConfig;
        // Merge with defaults to ensure all fields exist
        return { ...this.getDefaultConfiguration(), ...parsed };
      }
    } catch (error) {
      console.error('Failed to load environment configuration:', error);
    }
    
    return this.getDefaultConfiguration();
  }

  private saveConfiguration(): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save environment configuration:', error);
    }
  }

  private getDefaultConfiguration(): EnvironmentConfig {
    return {
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      googleClientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      googleRedirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth-callback.html`,
      ollamaBaseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434',
      saveForLaterMode: false,
      gmailQuery: 'is:unread -is:spam -is:starred in:inbox',
      scoringEnabled: true, // Enable by default for easier testing
      emailSummaryPoints: 10,
      linkOpenPoints: 3
    };
  }

  private validateConfiguration(config: any): config is EnvironmentConfig {
    return (
      typeof config === 'object' &&
      typeof config.googleClientId === 'string' &&
      typeof config.googleClientSecret === 'string' &&
      typeof config.googleRedirectUri === 'string' &&
      typeof config.ollamaBaseUrl === 'string' &&
      typeof config.saveForLaterMode === 'boolean' &&
      typeof config.gmailQuery === 'string' &&
      typeof config.scoringEnabled === 'boolean' &&
      typeof config.emailSummaryPoints === 'number' &&
      typeof config.linkOpenPoints === 'number'
    );
  }
}

export const environmentConfigService = new EnvironmentConfigService();
