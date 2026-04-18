import React, { useState } from 'react';
import { Palette, MessageSquare, Activity, AlertTriangle } from 'lucide-react';
import { ModelConfigPanel } from './ModelConfigPanel';
import { PromptConfigPanel } from './PromptConfigPanel';
import { PerformanceConfigPanel } from './PerformanceConfigPanel';
import { environmentConfigService } from '../services/environmentConfigService';

type SubTabId = 'models' | 'prompts' | 'performance';

interface SubTab {
  id: SubTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export const LocalAIConfigPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTabId>('models');
  const isLocalBackend = environmentConfigService.getAiBackend() === 'local';

  const subTabs: SubTab[] = [
    {
      id: 'models',
      label: 'Models',
      icon: Palette,
      component: <ModelConfigPanel onConfigChange={(config) => console.log('Model configuration updated:', config)} />
    },
    {
      id: 'prompts',
      label: 'Prompts',
      icon: MessageSquare,
      component: <PromptConfigPanel onConfigChange={(config) => console.log('Prompt configuration updated:', config)} />
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: Activity,
      component: <PerformanceConfigPanel onConfigChange={(config) => console.log('Performance configuration updated:', config)} />
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {!isLocalBackend && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            The AI backend is currently set to <strong>Gemini</strong>. Local AI settings will not be
            used for link summaries or email summarization until you switch to{' '}
            <strong>Use Local AI</strong> in <em>Preferences → Misc</em>.
          </p>
        </div>
      )}
      {/* Sub-tab Navigation */}
      <div className="flex border-b mb-6">
        {subTabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <IconComponent size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab Content */}
      <div className="flex-grow">
        {subTabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};
