import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Activity, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { PerformanceConfiguration } from '../types';
import { Button, Callout, Card } from './ui';

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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Configuration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure AI request handling and queue management
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={16} />}
            onClick={handleResetToDefault}
          >
            Reset to Default
          </Button>
        </div>

        {/* Queue Status Display */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Current Queue Status</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Queue Length</span>
                <span className={`font-semibold ${queueStatus.queueLength > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {queueStatus.queueLength}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Requests</span>
                <span className={`font-semibold ${queueStatus.activeRequests > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {queueStatus.activeRequests}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Processing</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${queueStatus.isProcessing ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {queueStatus.isProcessing ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clear Queue Button */}
          {(queueStatus.queueLength > 0 || queueStatus.activeRequests > 0) && (
            <div className="mt-4 pt-3 border-t dark:border-gray-700">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={handleClearQueue}
              >
                Clear Queue
              </Button>
            </div>
          )}
        </Card>

        {/* Configuration Settings */}
        <div className="space-y-6">
          {/* Queue Mode Toggle */}
          <Card padding="lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Queue Mode</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                <div className={`w-11 h-6 rounded-full transition-colors ${tempConfig.enableQueueMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform m-1 ${tempConfig.enableQueueMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </label>
            </div>

            {!tempConfig.enableQueueMode && (
              <Callout variant="warning" icon={<AlertTriangle className="w-4 h-4" />}>
                When queue mode is disabled, requests are processed immediately which may overwhelm the AI service if many requests are made simultaneously.
              </Callout>
            )}
          </Card>

          {/* Max Concurrent Requests */}
          <Card padding="lg">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Concurrent Requests
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
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
                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {tempConfig.maxConcurrentRequests === 1 ?
                'Requests will be processed one at a time (recommended for most setups)' :
                `Up to ${tempConfig.maxConcurrentRequests} requests can be processed simultaneously`
              }
            </div>
          </Card>

          {/* Request Delay */}
          <Card padding="lg">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Request Delay
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
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
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">ms</span>
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={12} />
              {tempConfig.requestDelay === 0 ?
                'No delay between requests' :
                `${tempConfig.requestDelay}ms delay between requests (${(tempConfig.requestDelay / 1000).toFixed(1)}s)`
              }
            </div>
          </Card>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end pt-4 border-t dark:border-gray-700">
            <Button
              variant="success"
              size="lg"
              leftIcon={<Save size={16} />}
              onClick={handleSaveConfig}
              disabled={isSaving}
              loading={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
