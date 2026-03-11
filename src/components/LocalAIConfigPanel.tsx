import React, { useState } from 'react';
import { Palette, MessageSquare, Activity } from 'lucide-react';
import { ModelConfigPanel } from './ModelConfigPanel';
import { PromptConfigPanel } from './PromptConfigPanel';
import { PerformanceConfigPanel } from './PerformanceConfigPanel';

type SubTabId = 'models' | 'prompts' | 'performance';

interface SubTab {
  id: SubTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export const LocalAIConfigPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTabId>('models');

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
