import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ModelConfiguration } from '../types';
import { ollamaService } from '../services/ollamaService';
import { DoubleModelConfig } from './DoubleModelConfig';

interface ModelSelectorProps {
  onModelChange?: (config: ModelConfiguration) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  onModelChange,
  className = ''
}) => {
  const [config, setConfig] = useState<ModelConfiguration>(ollamaService.getModelConfiguration());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initialize with current configuration
    setConfig(ollamaService.getModelConfiguration());
  }, []);

  const handleConfigChange = (newConfig: ModelConfiguration) => {
    setConfig(newConfig);
    // Call the legacy callback with the quick model for backward compatibility
    onModelChange?.(newConfig);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh the current configuration from storage
      const currentConfig = ollamaService.getModelConfiguration();
      setConfig(currentConfig);
      onModelChange?.(currentConfig);
    } catch (error) {
      console.error('Failed to refresh configuration:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="block text-sm font-medium text-gray-700">
          AI Models Configuration
        </label>
      </div>
      
      <div className="flex items-center gap-2">
        <DoubleModelConfig 
          onConfigChange={handleConfigChange}
          className="flex-1"
        />
        
        <button
          onClick={handleRefresh}
          className="px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          title="Refresh configuration"
          aria-label="Refresh configuration"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {/* Display current configuration */}
      <div className="mt-2 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span>Quick: <strong>{config.quick}</strong></span>
          <span>Detailed: <strong>{config.detailed}</strong></span>
        </div>
      </div>
    </div>
  );
};
