import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { ModelConfiguration, OllamaModel } from '../types';

interface ModelConfigPanelProps {
  onConfigChange?: (config: ModelConfiguration) => void;
  className?: string;
}

export const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<ModelConfiguration>(ollamaService.getModelConfiguration());
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const availableModels = await ollamaService.getAvailableModels();
      setModels(availableModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<ModelConfiguration>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    ollamaService.setModelConfiguration(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadModels();
      // Refresh the current configuration from storage
      const currentConfig = ollamaService.getModelConfiguration();
      setConfig(currentConfig);
      onConfigChange?.(currentConfig);
    } catch (error) {
      console.error('Failed to refresh configuration:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getModelDisplayName = (model: OllamaModel) => {
    return model.name || model.model;
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Models Configuration</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure which AI models to use for different tasks
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            title="Refresh models and configuration"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Model */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Model
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Used for fast operations like quick summaries and initial processing. Should be a lightweight, fast model.
              </p>
            </div>
            <select
              value={config.quick}
              onChange={(e) => handleConfigChange({ quick: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">Select a quick model...</option>
              {models.map((model) => (
                <option key={model.model} value={model.model}>
                  {getModelDisplayName(model)}
                </option>
              ))}
            </select>
          </div>

          {/* Detailed Model */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Model
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Used for complex operations like detailed analysis and flash card generation. Can be a more powerful, slower model.
              </p>
            </div>
            <select
              value={config.detailed}
              onChange={(e) => handleConfigChange({ detailed: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">Select a detailed model...</option>
              {models.map((model) => (
                <option key={model.model} value={model.model}>
                  {getModelDisplayName(model)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Configuration Display */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Current Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Quick Model:</span>
              <p className="font-medium text-gray-900">{config.quick || 'Not selected'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Detailed Model:</span>
              <p className="font-medium text-gray-900">{config.detailed || 'Not selected'}</p>
            </div>
          </div>
        </div>

        {/* Available Models List */}
        {models.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Available Models ({models.length})</h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {models.map((model) => (
                  <div
                    key={model.model}
                    className="bg-white rounded border p-2 text-sm"
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {getModelDisplayName(model)}
                    </div>
                    {model.size && (
                      <div className="text-gray-600 text-xs mt-1">
                        Size: {model.size}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Loading available models...</p>
          </div>
        )}

        {models.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-3">No models available. Make sure Ollama is running and has models installed.</p>
            <button
              onClick={loadModels}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
