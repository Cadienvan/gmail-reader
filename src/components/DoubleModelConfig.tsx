import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, X } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { ModelConfiguration, OllamaModel } from '../types';
import { Button, IconButton, Select, Label } from './ui';

interface DoubleModelConfigProps {
  onConfigChange?: (config: ModelConfiguration) => void;
  className?: string;
}

export const DoubleModelConfig: React.FC<DoubleModelConfigProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<ModelConfiguration>(ollamaService.getModelConfiguration());
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const getModelDisplayName = (model: OllamaModel) => {
    return model.name || model.model;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
        title="Model Configuration"
      >
        <Settings size={12} />
        <span className="text-xs font-medium">Models</span>
      </button>

      {isOpen && (
        <div className="absolute z-20 top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Model Configuration</h3>
            <IconButton
              onClick={() => setIsOpen(false)}
              label="Close"
              size="sm"
            >
              <X size={16} />
            </IconButton>
          </div>

          {/* Quick Model */}
          <div className="mb-4">
            <Label>Quick Model (Initial Summary)</Label>
            <Select
              value={config.quick}
              onChange={(e) => handleConfigChange({ quick: e.target.value })}
              disabled={isLoading}
            >
              {models.map((model) => (
                <option key={model.digest} value={getModelDisplayName(model)}>
                  {getModelDisplayName(model)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used for initial summaries. Faster and lighter.
            </p>
          </div>

          {/* Detailed Model */}
          <div className="mb-4">
            <Label>Detailed Model (Improved Summary)</Label>
            <Select
              value={config.detailed}
              onChange={(e) => handleConfigChange({ detailed: e.target.value })}
              disabled={isLoading}
            >
              {models.map((model) => (
                <option key={model.digest} value={getModelDisplayName(model)}>
                  {getModelDisplayName(model)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used when user requests improved summary. More detailed and thorough.
            </p>
          </div>

          {/* Refresh Button */}
          <div className="flex gap-2">
            <Button
              onClick={loadModels}
              disabled={isLoading}
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            >
              Refresh Models
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
