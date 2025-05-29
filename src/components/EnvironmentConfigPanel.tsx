import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Download, Upload, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { environmentConfigService } from '../services/environmentConfigService';
import type { EnvironmentConfig } from '../services/environmentConfigService';

interface EnvironmentConfigProps {
  onConfigChange?: (config: EnvironmentConfig) => void;
  className?: string;
  inline?: boolean; // New prop to show just the content without button
  onSwitchToOAuthSetup?: () => void; // New prop to switch to OAuth setup tab
}

export const EnvironmentConfigPanel: React.FC<EnvironmentConfigProps> = ({
  onConfigChange,
  className = '',
  inline = false,
  onSwitchToOAuthSetup
}) => {
  const [config, setConfig] = useState<EnvironmentConfig>(environmentConfigService.getConfiguration());
  const [isOpen, setIsOpen] = useState(false);
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

    if (!config.backendApiUrl.trim()) {
      errors.backendApiUrl = 'Backend API URL is required';
    } else {
      try {
        new URL(config.backendApiUrl);
      } catch {
        errors.backendApiUrl = 'Invalid URL format';
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

    setValidationErrors(errors);
  };

  const handleConfigChange = (field: keyof EnvironmentConfig, value: string) => {
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
      environmentConfigService.setConfiguration(config);
      onConfigChange?.(config);
      
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
  if (inline) {
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

          {/* API Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 border-b pb-1">API Endpoints</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Backend API URL
              </label>
              <input
                type="text"
                value={config.backendApiUrl}
                onChange={(e) => handleConfigChange('backendApiUrl', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm ${
                  validationErrors.backendApiUrl ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="http://localhost:3100"
              />
              {validationErrors.backendApiUrl && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.backendApiUrl}</p>
              )}
            </div>

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
  }

  // Original dropdown behavior

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1 border rounded-md text-sm transition-colors
          ${isConfigComplete && !hasErrors 
            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' 
            : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
          }`}
        title={isConfigComplete ? 'Environment configuration is complete' : 'Environment configuration is incomplete'}
      >
        <Settings className="w-4 h-4" />
        <span>Environment</span>
        {isConfigComplete && !hasErrors ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-8 right-0 z-50 w-96 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Environment Configuration</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="p-1 hover:bg-gray-100 rounded"
                title={showSecrets ? 'Hide secrets' : 'Show secrets'}
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ×
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
                </label>
                <input
                  type="text"
                  value={config.googleClientId}
                  onChange={(e) => handleConfigChange('googleClientId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm ${
                    validationErrors.googleClientId ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="your-client-id.apps.googleusercontent.com"
                />
                {validationErrors.googleClientId && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.googleClientId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URI
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
              </div>
            </div>

            {/* API Settings */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700 border-b pb-1">API Endpoints</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backend API URL
                </label>
                <input
                  type="text"
                  value={config.backendApiUrl}
                  onChange={(e) => handleConfigChange('backendApiUrl', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm ${
                    validationErrors.backendApiUrl ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="http://localhost:3100"
                />
                {validationErrors.backendApiUrl && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.backendApiUrl}</p>
                )}
              </div>

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
      )}
    </div>
  );
};
