import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Upload, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { environmentConfigService } from '../services/environmentConfigService';
import { emailCacheService } from '../services/emailCacheService';
import { deepAnalysisCache } from '../services/deepAnalysisCache';
import type { EnvironmentConfig } from '../services/environmentConfigService';

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
        deepAnalysisCache.clearCache();
        console.log('Gmail query changed - email and analysis caches cleared');
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
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-800 font-medium mb-1">Need Google OAuth Credentials?</p>
                <p className="text-blue-700">
                  Follow our comprehensive step-by-step guide to set up Google OAuth for Gmail integration.
                </p>
              </div>
            </div>
            <button
              onClick={onSwitchToOAuthSetup}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Setup Guide
            </button>
          </div>
        </div>
      )}

      {/* Configuration Status */}
      <div className="mb-4">
        {isConfigComplete && Object.keys(validationErrors).length === 0 ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Configuration Complete!</span>
            </div>
            <p className="text-green-700 text-sm mt-1">
              Your OAuth credentials are properly configured. You can now connect to Gmail.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 font-medium">Configuration Needed</span>
            </div>
            <p className="text-amber-700 text-sm mt-1">
              Please complete the OAuth setup to enable Gmail integration.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="p-1 hover:bg-gray-100 rounded"
            title={showSecrets ? 'Hide secrets' : 'Show secrets'}
          >
            {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-800 font-medium mb-1">Security Notice</p>
            <p className="text-amber-700">
              These environment variables are stored client-side and are visible to anyone who inspects your browser. 
              <strong> Do not share them with anyone</strong> or commit them to public repositories.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {/* Google OAuth Settings */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 border-b pb-1">Google OAuth</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
              <span className="text-gray-500 font-normal ml-1">(from Google Cloud Console)</span>
            </label>
            <input
              type="text"
              value={config.googleClientId}
              onChange={(e) => handleConfigChange('googleClientId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                validationErrors.googleClientId ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
            />
            {validationErrors.googleClientId && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.googleClientId}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Should end with '.apps.googleusercontent.com'
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
              <span className="text-gray-500 font-normal ml-1">(from Google Cloud Console)</span>
            </label>
            <input
              type={showSecrets ? 'text' : 'password'}
              value={config.googleClientSecret}
              onChange={(e) => handleConfigChange('googleClientSecret', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                validationErrors.googleClientSecret ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="GOCSPX-..."
            />
            {validationErrors.googleClientSecret && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.googleClientSecret}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Should start with 'GOCSPX-'
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Redirect URI
              <span className="text-gray-500 font-normal ml-1">(must match Google Cloud Console exactly)</span>
            </label>
            <input
              type="text"
              value={config.googleRedirectUri}
              onChange={(e) => handleConfigChange('googleRedirectUri', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                validationErrors.googleRedirectUri ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="http://localhost:5173/auth-callback.html"
            />
            {validationErrors.googleRedirectUri && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.googleRedirectUri}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Current domain: {window.location.origin}/auth-callback.html
            </p>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 border-b pb-1">AI Configuration</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ollama Base URL
            </label>
            <input
              type="text"
              value={config.ollamaBaseUrl}
              onChange={(e) => handleConfigChange('ollamaBaseUrl', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                validationErrors.ollamaBaseUrl ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="http://localhost:11434"
            />
            {validationErrors.ollamaBaseUrl && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.ollamaBaseUrl}</p>
            )}
          </div>
        </div>

        {/* Content Processing Settings */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 border-b pb-1">Content Processing</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gmail Query
              <span className="text-gray-500 font-normal ml-1">(filters which emails to fetch)</span>
            </label>
            <input
              type="text"
              value={config.gmailQuery}
              onChange={(e) => handleConfigChange('gmailQuery', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm ${
                validationErrors.gmailQuery ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="is:unread -is:spam -is:starred in:inbox"
            />
            {validationErrors.gmailQuery && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.gmailQuery}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Use Gmail search syntax. Examples: "is:unread", "from:example.com", "has:attachment", "-is:spam"
              <br />
              <span className="text-amber-600">Note: Changing this will clear the email cache.</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="saveForLaterMode"
              checked={config.saveForLaterMode}
              onChange={(e) => handleConfigChange('saveForLaterMode', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="saveForLaterMode" className="text-sm text-gray-700 cursor-pointer">
              Save for later mode
            </label>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            When enabled, content will be saved for later review instead of being immediately summarized. 
            The "Summarize email" button becomes "Save for later", and links are saved without generating summaries.
          </p>
        </div>

        {/* Email Scoring System */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 border-b pb-1">Email Quality Benchmark</h4>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="scoringEnabled"
              checked={config.scoringEnabled}
              onChange={(e) => handleConfigChange('scoringEnabled', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="scoringEnabled" className="text-sm text-gray-700 cursor-pointer">
              Enable email quality scoring
            </label>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            Track sender engagement by scoring your interactions. Helps identify which senders provide the most valuable content.
          </p>

          {config.scoringEnabled && (
            <div className="ml-6 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Summary Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.emailSummaryPoints}
                    onChange={(e) => handleConfigChange('emailSummaryPoints', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Points awarded when clicking "Summarize Email"
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link Open Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.linkOpenPoints}
                    onChange={(e) => handleConfigChange('linkOpenPoints', parseInt(e.target.value) || 3)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Points awarded when opening a link for AI summary
                  </p>
                </div>
              </div>
              
              <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                <strong>How it works:</strong> Senders get points when you interact with their content. 
                Higher scores indicate more valuable content. View rankings in Configuration → Email Scoring Dashboard.
              </div>
            </div>
          )}
        </div>

        {/* Import/Export */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 border-b pb-1">Import/Export</h4>
          
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>

          {showImport && (
            <div className="space-y-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste configuration JSON here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  Import
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportText(''); }}
                  className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t mt-4">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSaving || hasErrors}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save & Reload'}
        </button>
      </div>

      {hasErrors && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">
            Please fix the validation errors above before saving.
          </p>
        </div>
      )}
    </div>
  );
};
