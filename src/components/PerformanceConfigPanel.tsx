import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Activity, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { PerformanceConfiguration } from '../types';

interface PerformanceConfigPanelProps {
  onConfigChange?: (config: PerformanceConfiguration) => void;
  className?: string;
}

export const PerformanceConfigPanel: React.FC<PerformanceConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<PerformanceConfiguration>(ollamaService.getPerformanceConfiguration());
  const [tempConfig, setTempConfig] = useState<PerformanceConfiguration>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ queueLength: 0, activeRequests: 0, isProcessing: false });

  // Update queue status periodically
  useEffect(() => {
    const updateQueueStatus = () => {
      const status = ollamaService.getQueueStatus();
      setQueueStatus(status);
    };

    // Initial update
    updateQueueStatus();

    // Update every second when queue is active
    const interval = setInterval(updateQueueStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTempConfig(config);
  }, [config]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      ollamaService.setPerformanceConfiguration(tempConfig);
      setConfig(tempConfig);
      onConfigChange?.(tempConfig);
    } catch (error) {
      console.error('Failed to save performance configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to reset performance settings to default?')) {
      const defaultConfig: PerformanceConfiguration = {
        enableQueueMode: false,
        maxConcurrentRequests: 1,
        requestDelay: 1000
      };
      setTempConfig(defaultConfig);
    }
  };

  const handleClearQueue = () => {
    if (confirm('Are you sure you want to clear the queue? This will cancel all pending requests.')) {
      ollamaService.clearQueue();
    }
  };

  const hasChanges = JSON.stringify(tempConfig) !== JSON.stringify(config);

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Performance Configuration</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure AI request handling and queue management
            </p>
          </div>
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            title="Reset to default settings"
          >
            <RotateCcw size={16} />
            Reset to Default
          </button>
        </div>

        {/* Queue Status Display */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Current Queue Status</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded p-3 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Queue Length</span>
                <span className={`font-semibold ${queueStatus.queueLength > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {queueStatus.queueLength}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded p-3 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Requests</span>
                <span className={`font-semibold ${queueStatus.activeRequests > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {queueStatus.activeRequests}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded p-3 border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Processing</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${queueStatus.isProcessing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-semibold">
                    {queueStatus.isProcessing ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clear Queue Button */}
          {(queueStatus.queueLength > 0 || queueStatus.activeRequests > 0) && (
            <div className="mt-4 pt-3 border-t">
              <button
                onClick={handleClearQueue}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
              >
                <Trash2 size={14} />
                Clear Queue
              </button>
            </div>
          )}
        </div>

        {/* Configuration Settings */}
        <div className="space-y-6">
          {/* Queue Mode Toggle */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Queue Mode</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Enable request queuing to manage AI service load and prevent overwhelming the server
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempConfig.enableQueueMode}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, enableQueueMode: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${tempConfig.enableQueueMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform m-1 ${tempConfig.enableQueueMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </label>
            </div>

            {!tempConfig.enableQueueMode && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-700">
                  When queue mode is disabled, requests are processed immediately which may overwhelm the AI service if many requests are made simultaneously.
                </p>
              </div>
            )}
          </div>

          {/* Max Concurrent Requests */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Concurrent Requests
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Maximum number of AI requests that can be processed simultaneously
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={tempConfig.maxConcurrentRequests}
                onChange={(e) => setTempConfig(prev => ({ ...prev, maxConcurrentRequests: parseInt(e.target.value) }))}
                className="flex-1"
              />
              <div className="flex items-center gap-2 min-w-16">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tempConfig.maxConcurrentRequests}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, maxConcurrentRequests: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                />
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-500">
              {tempConfig.maxConcurrentRequests === 1 ? 
                'Requests will be processed one at a time (recommended for most setups)' :
                `Up to ${tempConfig.maxConcurrentRequests} requests can be processed simultaneously`
              }
            </div>
          </div>

          {/* Request Delay */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Delay
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Delay between processing queued requests (in milliseconds)
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={tempConfig.requestDelay}
                onChange={(e) => setTempConfig(prev => ({ ...prev, requestDelay: parseInt(e.target.value) }))}
                className="flex-1"
              />
              <div className="flex items-center gap-2 min-w-24">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={tempConfig.requestDelay}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, requestDelay: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                />
                <span className="text-sm text-gray-500">ms</span>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              {tempConfig.requestDelay === 0 ? 
                'No delay between requests' :
                `${tempConfig.requestDelay}ms delay between requests (${(tempConfig.requestDelay / 1000).toFixed(1)}s)`
              }
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
