import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';
import type { PromptConfiguration } from '../types';
import { Button, EditableField } from './ui';

interface PromptConfigPanelProps {
  onConfigChange?: (config: PromptConfiguration) => void;
  className?: string;
}

const CONTENT_TIP = (
  <p>
    <strong>Tip:</strong> Use{' '}
    <code className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded">{'{CONTENT}'}</code> as a placeholder
    where the content should be inserted.
  </p>
);

export const PromptConfigPanel: React.FC<PromptConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [config, setConfig] = useState<PromptConfiguration>(ollamaService.getPromptConfiguration());

  const persist = (next: PromptConfiguration) => {
    ollamaService.setPromptConfiguration(next);
    setConfig(next);
    onConfigChange?.(next);
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to reset prompts to default? This will overwrite your custom prompts.')) {
      ollamaService.resetPromptConfigurationToDefault();
      const defaultConfig = ollamaService.getPromptConfiguration();
      setConfig(defaultConfig);
      onConfigChange?.(defaultConfig);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Prompt Configuration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Customize the prompts used for AI-powered summaries and flash card generation
            </p>
          </div>
          <Button
            variant="secondary"
            leftIcon={<RotateCcw size={16} />}
            onClick={handleResetToDefault}
            title="Reset to default prompts"
          >
            Reset to Default
          </Button>
        </div>

        <div className="space-y-6">
          <EditableField
            label="Summary Prompt"
            description="Used to generate concise summaries of email content and links"
            value={config.summaryPrompt}
            onSave={(value) => persist({ ...config, summaryPrompt: value })}
            mono
            rows={12}
            placeholder="Enter your summary prompt here. Use {CONTENT} as a placeholder for the content to be summarized."
            tip={CONTENT_TIP}
          />

          <EditableField
            label="Flash Card Prompt"
            description="Used to generate educational flash cards from content"
            value={config.flashCardPrompt}
            onSave={(value) => persist({ ...config, flashCardPrompt: value })}
            mono
            rows={12}
            placeholder="Enter your flash card prompt here. Use {CONTENT} as a placeholder for the content to be analyzed."
            tip={CONTENT_TIP}
          />
        </div>
      </div>
    </div>
  );
};
