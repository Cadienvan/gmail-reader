import React, { useState, useEffect } from 'react';
import { Settings, RotateCcw, Save, Edit } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { PromptConfiguration } from '../types';

interface PromptConfigProps {
  onConfigChange?: (config: PromptConfiguration) => void;
  className?: string;
}

export const PromptConfig: React.FC<PromptConfigProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<PromptConfiguration>(ollamaService.getPromptConfiguration());
  const [isOpen, setIsOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingFlashCard, setEditingFlashCard] = useState(false);
  const [tempSummaryPrompt, setTempSummaryPrompt] = useState(config.summaryPrompt);
  const [tempFlashCardPrompt, setTempFlashCardPrompt] = useState(config.flashCardPrompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTempSummaryPrompt(config.summaryPrompt);
    setTempFlashCardPrompt(config.flashCardPrompt);
  }, [config]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const newConfig: PromptConfiguration = {
        summaryPrompt: tempSummaryPrompt,
        flashCardPrompt: tempFlashCardPrompt
      };
      
      ollamaService.setPromptConfiguration(newConfig);
      setConfig(newConfig);
      onConfigChange?.(newConfig);
      setEditingSummary(false);
      setEditingFlashCard(false);
    } catch (error) {
      console.error('Failed to save prompt configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to reset prompts to default? This will overwrite your custom prompts.')) {
      ollamaService.resetPromptConfigurationToDefault();
      const defaultConfig = ollamaService.getPromptConfiguration();
      setConfig(defaultConfig);
      setTempSummaryPrompt(defaultConfig.summaryPrompt);
      setTempFlashCardPrompt(defaultConfig.flashCardPrompt);
      onConfigChange?.(defaultConfig);
      setEditingSummary(false);
      setEditingFlashCard(false);
    }
  };

  const hasChanges = tempSummaryPrompt !== config.summaryPrompt || tempFlashCardPrompt !== config.flashCardPrompt;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors whitespace-nowrap text-sm shadow-sm"
        title="Configure AI Prompts"
      >
        <Settings size={15} />
        <span>Prompt Config</span>
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-[800px] bg-white border border-gray-300 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">AI Prompt Configuration</h3>
            <div className="flex gap-2">
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                title="Reset to default prompts"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Summary Prompt Configuration */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-700">Summary Prompt</h4>
                <button
                  onClick={() => setEditingSummary(!editingSummary)}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  <Edit size={14} />
                  {editingSummary ? 'View' : 'Edit'}
                </button>
              </div>
              
              {editingSummary ? (
                <div>
                  <textarea
                    value={tempSummaryPrompt}
                    onChange={(e) => setTempSummaryPrompt(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical"
                    placeholder="Enter your summary prompt here. Use {CONTENT} as a placeholder for the content to be summarized."
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Use <code className="bg-gray-100 px-1 rounded">{'{CONTENT}'}</code> as a placeholder where the content should be inserted.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {config.summaryPrompt.length > 200 
                      ? config.summaryPrompt.substring(0, 200) + '...' 
                      : config.summaryPrompt}
                  </pre>
                </div>
              )}
            </div>

            {/* Flash Card Prompt Configuration */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-700">Flash Card Prompt</h4>
                <button
                  onClick={() => setEditingFlashCard(!editingFlashCard)}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  <Edit size={14} />
                  {editingFlashCard ? 'View' : 'Edit'}
                </button>
              </div>
              
              {editingFlashCard ? (
                <div>
                  <textarea
                    value={tempFlashCardPrompt}
                    onChange={(e) => setTempFlashCardPrompt(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical"
                    placeholder="Enter your flash card prompt here. Use {CONTENT} as a placeholder for the content to be analyzed."
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Use <code className="bg-gray-100 px-1 rounded">{'{CONTENT}'}</code> as a placeholder where the content should be inserted.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {config.flashCardPrompt.length > 200 
                      ? config.flashCardPrompt.substring(0, 200) + '...' 
                      : config.flashCardPrompt}
                  </pre>
                </div>
              )}
            </div>

            {/* Save Button */}
            {hasChanges && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
