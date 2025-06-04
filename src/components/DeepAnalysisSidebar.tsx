import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Square, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle,
  Mail,
  Link as LinkIcon,
  Star,
  Trash2,
  Settings,
  RefreshCw,
  TestTube,
  Users
} from 'lucide-react';
import type { DeepAnalysisProgress, QualityAssessmentResult, DeepAnalysisConfig, EmailSender, SenderSelectionConfig } from '../types';
import { deepAnalysisService } from '../services/deepAnalysisService';
import { ollamaService } from '../services/ollamaService';
import { SenderSelectionModal } from './SenderSelectionModal';

interface DeepAnalysisSidebarProps {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

export const DeepAnalysisSidebar: React.FC<DeepAnalysisSidebarProps> = ({
  isVisible,
  onToggle,
  className = ''
}) => {
  const [progress, setProgress] = useState<DeepAnalysisProgress>(deepAnalysisService.getProgress());
  const [config, setConfig] = useState<DeepAnalysisConfig>(deepAnalysisService.getConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showSenderModal, setShowSenderModal] = useState(false);
  const [availableSenders, setAvailableSenders] = useState<EmailSender[]>([]);
  const [isLoadingSenders, setIsLoadingSenders] = useState(false);

  useEffect(() => {
    const unsubscribe = deepAnalysisService.subscribe(setProgress);
    return unsubscribe;
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      // Collect unique senders first
      setIsLoadingSenders(true);
      const senders = await deepAnalysisService.collectUniqueSenders();
      setAvailableSenders(senders);
      setIsLoadingSenders(false);
      
      // Show sender selection modal
      setShowSenderModal(true);
    } catch (error) {
      console.error('Failed to collect senders:', error);
      alert(`Failed to collect senders: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoadingSenders(false);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSenderSelectionConfirm = async (senderConfigs: SenderSelectionConfig[]) => {
    setShowSenderModal(false);
    setIsStarting(true);
    
    try {
      if (senderConfigs.length === 0) {
        alert('No senders selected. Please select at least one sender to analyze.');
        return;
      }
      
      // Start analysis with selected senders
      await deepAnalysisService.startDeepAnalysisWithSenders(senderConfigs);
    } catch (error) {
      console.error('Failed to start deep analysis:', error);
      alert(`Failed to start deep analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSenderSelectionCancel = () => {
    setShowSenderModal(false);
    setIsStarting(false);
  };

  const handleStop = () => {
    deepAnalysisService.stopDeepAnalysis();
  };

  const handleClearResults = () => {
    if (confirm('Are you sure you want to clear all deep analysis results?')) {
      deepAnalysisService.clearResults();
    }
  };

  const handleTestQualityAssessment = async () => {
    try {
      console.log('Starting quality assessment consistency test...');
      await ollamaService.testQualityAssessmentConsistency();
      alert('Quality assessment test completed. Check the console for results.');
    } catch (error) {
      console.error('Quality assessment test failed:', error);
      alert(`Quality assessment test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefreshPrompt = () => {
    if (confirm('This will reset the quality assessment prompt to the default. Continue?')) {
      ollamaService.refreshQualityAssessmentPrompt();
      alert('Quality assessment prompt has been refreshed to default.');
    }
  };

  const handleDebugJSONIssue = async () => {
    try {
      console.log('Starting JSON format degradation debug...');
      await ollamaService.debugQualityAssessmentIssue();
      alert('JSON debug test completed. Check the console for detailed results.');
    } catch (error) {
      console.error('JSON debug test failed:', error);
      alert(`JSON debug test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConfigChange = (key: keyof DeepAnalysisConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    deepAnalysisService.setConfig(newConfig);
  };

  const getStatusIcon = (result: QualityAssessmentResult) => {
    if (result.isHighQuality) return <CheckCircle size={16} className="text-green-600" />;
    if (result.qualityScore > 50) return <Clock size={16} className="text-yellow-600" />;
    return <XCircle size={16} className="text-gray-400" />;
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return 'Not started';
    const end = endTime || Date.now();
    const duration = Math.floor((end - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const statistics = deepAnalysisService.getStatistics();

  return (
    <div className={`${className} transition-all duration-300 ease-in-out ${isVisible ? 'w-80' : 'w-8'} bg-gray-50 border-l border-gray-200 flex flex-col`}>
      {/* Toggle Button */}
      <div className="p-2 border-b border-gray-200 flex justify-center">
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-800"
          title={isVisible ? 'Hide Deep Analysis' : 'Show Deep Analysis'}
        >
          {isVisible ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {isVisible && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 size={16} />
                Deep Analysis
              </h3>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="p-1 rounded hover:bg-gray-200 text-gray-600"
                title="Settings"
              >
                <Settings size={14} />
              </button>
            </div>

            {/* Configuration Panel */}
            {showConfig && (
              <div className="mb-4 p-3 bg-white rounded border text-sm space-y-2">
                <div>
                  <label className="block text-gray-700 mb-1">Quality Threshold</label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={config.qualityThreshold}
                    onChange={(e) => handleConfigChange('qualityThreshold', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{config.qualityThreshold}%</span>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Diversity Threshold</label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={config.diversityThreshold}
                    onChange={(e) => handleConfigChange('diversityThreshold', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{config.diversityThreshold}%</span>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">Max Pages to Process</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.maxPagesToProcess}
                    onChange={(e) => handleConfigChange('maxPagesToProcess', parseInt(e.target.value))}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={config.autoCreateTabs}
                      onChange={(e) => handleConfigChange('autoCreateTabs', e.target.checked)}
                    />
                    Auto-create tabs for high-quality content
                  </label>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!progress.isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  <Users size={14} />
                  {isStarting ? 'Loading Senders...' : 'Select Senders & Start'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  <Square size={14} />
                  Stop
                </button>
              )}
              
              {progress.qualityResults.length > 0 && (
                <button
                  onClick={handleClearResults}
                  className="p-2 text-gray-600 hover:text-red-600 rounded-md hover:bg-gray-200"
                  title="Clear results"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Diagnostic Tools */}
            {showConfig && (
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={handleTestQualityAssessment}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                  title="Test quality assessment consistency"
                >
                  <TestTube size={12} />
                  Test JSON
                </button>
                <button
                  onClick={handleRefreshPrompt}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  title="Refresh quality assessment prompt"
                >
                  <RefreshCw size={12} />
                  Reset Prompt
                </button>
                <button
                  onClick={handleDebugJSONIssue}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  title="Debug JSON format degradation issue"
                >
                  <TestTube size={12} />
                  Debug Issue
                </button>
              </div>
            )}
          </div>

          {/* Progress and Statistics */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            {/* Progress Bar */}
            {progress.isRunning && (
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{progress.processedEmails} / {progress.totalEmails || '?'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: progress.totalEmails ? 
                        `${(progress.processedEmails / progress.totalEmails) * 100}%` : 
                        '0%'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={progress.isRunning ? 'text-blue-600' : 'text-gray-900'}>
                  {progress.isRunning ? 'Running' : progress.endTime ? 'Completed' : 'Idle'}
                </span>
              </div>
              
              {progress.startTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="text-gray-900">
                    {formatDuration(progress.startTime, progress.endTime)}
                  </span>
                </div>
              )}

              {progress.currentPage > 1 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Page:</span>
                  <span className="text-gray-900">{progress.currentPage}</span>
                </div>
              )}

              {progress.currentlyProcessingEmailId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Currently Processing:</span>
                  <span className="text-blue-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    In Progress
                  </span>
                </div>
              )}

              {progress.error && (
                <div className="text-red-600 text-xs mt-2 p-2 bg-red-50 rounded">
                  {progress.error}
                </div>
              )}
            </div>

            {/* Statistics */}
            {statistics.totalProcessed > 0 && (
              <div className="text-sm space-y-1 pt-2 border-t border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Processed:</span>
                  <span className="text-gray-900">{statistics.totalProcessed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">High Quality:</span>
                  <span className="text-green-600 font-medium">{statistics.highQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">With Links:</span>
                  <span className="text-blue-600">{statistics.withLinks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Quality:</span>
                  <span className="text-gray-900">{statistics.averageQuality.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Mail size={14} />
                Processed Emails ({progress.qualityResults.length})
              </h4>
              
              {progress.qualityResults.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  No emails processed yet
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Show currently processing email at the top */}
                  {progress.currentlyProcessingEmailId && (
                    <div className="p-3 rounded border border-blue-200 bg-blue-50 text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-blue-700">Currently Processing</span>
                      </div>
                      <div className="text-blue-600 text-xs font-medium line-clamp-2">
                        {progress.currentlyProcessingEmailSubject || `Email ID: ${progress.currentlyProcessingEmailId}`}
                      </div>
                    </div>
                  )}
                  
                  {progress.qualityResults.slice().reverse().map((result) => (
                    <div 
                      key={result.emailId}
                      className={`p-3 rounded border text-sm ${
                        result.isHighQuality ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result)}
                          {result.isHighQuality && <Star size={12} className="text-yellow-500" />}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.qualityScore}% / {result.diversityScore}%
                        </div>
                      </div>
                      
                      <div className="font-medium text-gray-900 mb-1 line-clamp-2">
                        {result.subject}
                      </div>
                      
                      <div className="text-gray-600 text-xs mb-2">
                        From: {result.from}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          result.contentType === 'full-email' ? 'bg-blue-100 text-blue-700' :
                          result.contentType === 'links-only' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {result.contentType}
                        </span>
                        
                        {result.hasLinks && (
                          <span className="flex items-center gap-1 text-xs text-blue-600">
                            <LinkIcon size={10} />
                            Links
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-600 line-clamp-2">
                        {result.reasoning}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Sender Selection Modal */}
      <SenderSelectionModal
        isOpen={showSenderModal}
        onClose={handleSenderSelectionCancel}
        onConfirm={handleSenderSelectionConfirm}
        senders={availableSenders}
        isLoading={isLoadingSenders}
        title="Choose Senders for Deep Analysis"
      />
    </div>
  );
};
