import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Upload, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { environmentConfigService } from '../services/environmentConfigService';
import { emailCacheService } from '../services/emailCacheService';
import type { EnvironmentConfig } from '../services/environmentConfigService';
import { Button, IconButton, Input, Textarea, Label, Callout } from './ui';

interface EnvironmentConfigProps {
  onConfigChange?: (config: EnvironmentConfig) => void;
  className?: string;
  onSwitchToOAuthSetup?: () => void; // New prop to switch to OAuth setup tab
}

export const EnvironmentConfigPanel: React.FC<EnvironmentConfigProps> = ({
  onConfigChange,
  className = '',
  onSwitchToOAuthSetup
}) => {
  const [config, setConfig] = useState<EnvironmentConfig>(environmentConfigService.getConfiguration());
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof EnvironmentConfig, string>>>({});

  useEffect(() => {
    validateConfiguration();
  }, [config]);

  const validateConfiguration = () => {
    const errors: Partial<Record<keyof EnvironmentConfig, string>> = {};

    if (!config.googleClientId.trim()) {
      errors.googleClientId = 'Google Client ID is required';
    } else if (!config.googleClientId.includes('.apps.googleusercontent.com')) {
      errors.googleClientId = 'Invalid Client ID format';
    }

    if (!config.googleClientSecret.trim()) {
      errors.googleClientSecret = 'Google Client Secret is required';
    } else if (!config.googleClientSecret.startsWith('GOCSPX-')) {
      errors.googleClientSecret = 'Invalid Client Secret format';
    }

    if (!config.googleRedirectUri.trim()) {
      errors.googleRedirectUri = 'Redirect URI is required';
    } else {
      try {
        new URL(config.googleRedirectUri);
      } catch {
        errors.googleRedirectUri = 'Invalid URL format';
      }
    }

    if (!config.ollamaBaseUrl.trim()) {
      errors.ollamaBaseUrl = 'Ollama Base URL is required';
    } else {
      try {
        new URL(config.ollamaBaseUrl);
      } catch {
        errors.ollamaBaseUrl = 'Invalid URL format';
      }
    }

    if (!config.gmailQuery.trim()) {
      errors.gmailQuery = 'Gmail query is required';
    }

    setValidationErrors(errors);
  };

  const handleConfigChange = (field: keyof EnvironmentConfig, value: string | boolean | number) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
  };

  const handleSave = async () => {
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix validation errors before saving.');
      return;
    }

    setIsSaving(true);
    try {
      // Get the current configuration to check if Gmail query has changed
      const currentConfig = environmentConfigService.getConfiguration();
      const gmailQueryChanged = currentConfig.gmailQuery !== config.gmailQuery;

      // Save the new configuration
      environmentConfigService.setConfiguration(config);
      onConfigChange?.(config);

      // Clear email cache if Gmail query has changed
      if (gmailQueryChanged) {
        emailCacheService.forceRefresh();
        console.log('Gmail query changed - email cache cleared');
      }

      // Refresh the page to apply new configuration
      if (confirm('Configuration saved! The page will refresh to apply changes. Continue?')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default configuration? This will overwrite your current settings.')) {
      environmentConfigService.resetToDefaults();
      const defaultConfig = environmentConfigService.getConfiguration();
      setConfig(defaultConfig);
      onConfigChange?.(defaultConfig);
    }
  };

  const handleExport = () => {
    const configJson = environmentConfigService.exportConfiguration();
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gmail-reader-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) {
      alert('Please paste configuration JSON');
      return;
    }

    if (environmentConfigService.importConfiguration(importText)) {
      const newConfig = environmentConfigService.getConfiguration();
      setConfig(newConfig);
      onConfigChange?.(newConfig);
      setImportText('');
      setShowImport(false);
      alert('Configuration imported successfully!');
    } else {
      alert('Failed to import configuration. Please check the JSON format.');
    }
  };

  const isConfigComplete = environmentConfigService.isConfigurationComplete();
  const hasErrors = Object.keys(validationErrors).length > 0;

  // Render inline content without button wrapper
  return (
    <div className={className}>
      {/* OAuth Setup Link */}
      {onSwitchToOAuthSetup && (
        <Callout variant="info" icon={<CheckCircle className="w-5 h-5" />} className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium mb-1">Need Google OAuth Credentials?</p>
              <p>
                Follow our comprehensive step-by-step guide to set up Google OAuth for Gmail integration.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={onSwitchToOAuthSetup}
              className="flex-shrink-0"
            >
              Setup Guide
            </Button>
          </div>
        </Callout>
      )}

      {/* Configuration Status */}
      <div className="mb-4">
        {isConfigComplete && Object.keys(validationErrors).length === 0 ? (
          <Callout variant="success" icon={<CheckCircle className="w-5 h-5" />}>
            <p className="font-medium">Configuration Complete!</p>
            <p className="text-sm mt-1">
              Your OAuth credentials are properly configured. You can now connect to Gmail.
            </p>
          </Callout>
        ) : (
          <Callout variant="warning" icon={<AlertCircle className="w-5 h-5" />}>
            <p className="font-medium">Configuration Needed</p>
            <p className="text-sm mt-1">
              Please complete the OAuth setup to enable Gmail integration.
            </p>
          </Callout>
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <IconButton
            label={showSecrets ? 'Hide secrets' : 'Show secrets'}
            onClick={() => setShowSecrets(!showSecrets)}
            size="sm"
          >
            {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>

      {/* Security Warning */}
      <Callout variant="warning" icon={<AlertCircle className="w-5 h-5" />} className="mb-4">
        <p className="font-medium mb-1">Security Notice</p>
        <p>
          These environment variables are stored client-side and are visible to anyone who inspects your browser.
          <strong> Do not share them with anyone</strong> or commit them to public repositories.
        </p>
      </Callout>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {/* Google OAuth Settings */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-1">Google OAuth</h4>

          <div>
            <Label htmlFor="googleClientId">
              Client ID
              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(from Google Cloud Console)</span>
            </Label>
            <Input
              id="googleClientId"
              type="text"
              value={config.googleClientId}
              onChange={(e) => handleConfigChange('googleClientId', e.target.value)}
              className={validationErrors.googleClientId ? 'border-red-300 dark:border-red-600' : ''}
              placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
            />
            {validationErrors.googleClientId && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{validationErrors.googleClientId}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Should end with '.apps.googleusercontent.com'
            </p>
          </div>

          <div>
            <Label htmlFor="googleClientSecret">
              Client Secret
              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(from Google Cloud Console)</span>
            </Label>
            <Input
              id="googleClientSecret"
              type={showSecrets ? 'text' : 'password'}
              value={config.googleClientSecret}
              onChange={(e) => handleConfigChange('googleClientSecret', e.target.value)}
              className={validationErrors.googleClientSecret ? 'border-red-300 dark:border-red-600' : ''}
              placeholder="GOCSPX-..."
            />
            {validationErrors.googleClientSecret && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{validationErrors.googleClientSecret}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Should start with 'GOCSPX-'
            </p>
          </div>

          <div>
            <Label htmlFor="googleRedirectUri">
              Redirect URI
              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(must match Google Cloud Console exactly)</span>
            </Label>
            <Input
              id="googleRedirectUri"
              type="text"
              value={config.googleRedirectUri}
              onChange={(e) => handleConfigChange('googleRedirectUri', e.target.value)}
              className={validationErrors.googleRedirectUri ? 'border-red-300 dark:border-red-600' : ''}
              placeholder="http://localhost:5173/auth-callback.html"
            />
            {validationErrors.googleRedirectUri && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{validationErrors.googleRedirectUri}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Current domain: {window.location.origin}/auth-callback.html
            </p>
          </div>
        </div>

        {/* Content Processing Settings */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-1">Content Processing</h4>

          <div>
            <Label htmlFor="gmailQuery">
              Gmail Query
              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(filters which emails to fetch)</span>
            </Label>
            <Input
              id="gmailQuery"
              type="text"
              value={config.gmailQuery}
              onChange={(e) => handleConfigChange('gmailQuery', e.target.value)}
              className={validationErrors.gmailQuery ? 'border-red-300 dark:border-red-600' : ''}
              placeholder="is:unread -is:spam -is:starred in:inbox"
            />
            {validationErrors.gmailQuery && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{validationErrors.gmailQuery}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Use Gmail search syntax. Examples: "is:unread", "from:example.com", "has:attachment", "-is:spam"
              <br />
              <span className="text-amber-600 dark:text-amber-400">Note: Changing this will clear the email cache.</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="saveForLaterMode"
              checked={config.saveForLaterMode}
              onChange={(e) => handleConfigChange('saveForLaterMode', e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="saveForLaterMode" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Save for later mode
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
            When enabled, content will be saved for later review instead of being immediately summarized.
            The "Summarize email" button becomes "Save for later", and links are saved without generating summaries.
          </p>
        </div>

        {/* Import/Export */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-1">Import/Export</h4>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowImport(!showImport)}
            >
              Import
            </Button>
          </div>

          {showImport && (
            <div className="space-y-2">
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste configuration JSON here..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleImport}
                >
                  Import
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setShowImport(false); setImportText(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700 mt-4">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RotateCcw className="w-4 h-4" />}
          onClick={handleReset}
        >
          Reset
        </Button>

        <Button
          variant="primary"
          leftIcon={<Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={isSaving || hasErrors}
          loading={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save & Reload'}
        </Button>
      </div>

      {hasErrors && (
        <Callout variant="danger" className="mt-3">
          Please fix the validation errors above before saving.
        </Callout>
      )}
    </div>
  );
};
