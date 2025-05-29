import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Edit, Eye } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { PromptConfiguration } from '../types';

interface PromptConfigPanelProps {
  onConfigChange?: (config: PromptConfiguration) => void;
  className?: string;
}

export const PromptConfigPanel: React.FC<PromptConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<PromptConfiguration>(ollamaService.getPromptConfiguration());
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
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Prompt Configuration</h3>
            <p className="text-sm text-gray-600 mt-1">
              Customize the prompts used for AI-powered summaries and flash card generation
            </p>
          </div>
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            title="Reset to default prompts"
          >
            <RotateCcw size={16} />
            Reset to Default
          </button>
        </div>

        <div className="space-y-6">
          {/* Summary Prompt Configuration */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Summary Prompt</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Used to generate concise summaries of email content and links
                </p>
              </div>
              <button
                onClick={() => setEditingSummary(!editingSummary)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                {editingSummary ? <Eye size={16} /> : <Edit size={16} />}
                {editingSummary ? 'Preview' : 'Edit'}
              </button>
            </div>
            
            {editingSummary ? (
              <div>
                <textarea
                  value={tempSummaryPrompt}
                  onChange={(e) => setTempSummaryPrompt(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your summary prompt here. Use {CONTENT} as a placeholder for the content to be summarized."
                />
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Use <code className="bg-blue-100 px-1 rounded">{'{CONTENT}'}</code> as a placeholder where the content should be inserted.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md border">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {config.summaryPrompt}
                </pre>
              </div>
            )}
          </div>

          {/* Flash Card Prompt Configuration */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Flash Card Prompt</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Used to generate educational flash cards from content
                </p>
              </div>
              <button
                onClick={() => setEditingFlashCard(!editingFlashCard)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                {editingFlashCard ? <Eye size={16} /> : <Edit size={16} />}
                {editingFlashCard ? 'Preview' : 'Edit'}
              </button>
            </div>
            
            {editingFlashCard ? (
              <div>
                <textarea
                  value={tempFlashCardPrompt}
                  onChange={(e) => setTempFlashCardPrompt(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your flash card prompt here. Use {CONTENT} as a placeholder for the content to be analyzed."
                />
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Use <code className="bg-blue-100 px-1 rounded">{'{CONTENT}'}</code> as a placeholder where the content should be inserted.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md border">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {config.flashCardPrompt}
                </pre>
              </div>
            )}
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
    </div>
  );
};
