export interface EnvironmentConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  backendApiUrl: string;
  ollamaBaseUrl: string;
}

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
    this.config = { ...config };
    this.saveConfiguration();
  }

  /**
   * Update specific configuration field
   */
  updateConfigField(field: keyof EnvironmentConfig, value: string): void {
    this.config[field] = value;
    this.saveConfiguration();
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
      this.config.backendApiUrl &&
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
   * Get backend API URL
   */
  getBackendApiUrl(): string {
    return this.config.backendApiUrl;
  }

  /**
   * Get Ollama base URL
   */
  getOllamaBaseUrl(): string {
    return this.config.ollamaBaseUrl;
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
      backendApiUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3100',
      ollamaBaseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
    };
  }

  private validateConfiguration(config: any): config is EnvironmentConfig {
    return (
      typeof config === 'object' &&
      typeof config.googleClientId === 'string' &&
      typeof config.googleClientSecret === 'string' &&
      typeof config.googleRedirectUri === 'string' &&
      typeof config.backendApiUrl === 'string' &&
      typeof config.ollamaBaseUrl === 'string'
    );
  }
}

export const environmentConfigService = new EnvironmentConfigService();
