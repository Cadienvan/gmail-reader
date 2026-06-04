import React, { useState } from 'react';
import { Info, Settings } from 'lucide-react';
import { OAuthSetupGuide } from './OAuthSetupGuide';
import { EnvironmentConfigPanel } from './EnvironmentConfigPanel';

type SubTabId = 'info' | 'config';

interface SubTab {
  id: SubTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export const OAuthPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTabId>('config');

  const subTabs: SubTab[] = [
    {
      id: 'info',
      label: 'Info',
      icon: Info,
      component: <OAuthSetupGuide />
    },
    {
      id: 'config',
      label: 'Config',
      icon: Settings,
      component: (
        <EnvironmentConfigPanel
          onConfigChange={(config) => {
            console.log('Environment configuration updated:', config);
          }}
          onSwitchToOAuthSetup={() => setActiveTab('info')}
        />
      )
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {subTabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
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
