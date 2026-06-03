import React, { useState } from 'react';
import { Filter, HardDrive, Zap, Settings2, Keyboard } from 'lucide-react';
import { UrlFilterConfigPanel } from './UrlFilterConfigPanel';
import { StorageConfigPanel } from './StorageConfigPanel';
import { RulesConfigPanel } from './RulesConfigPanel';
import { MiscConfigPanel } from './MiscConfigPanel';
import { KeyBindingsConfigPanel } from './KeyBindingsConfigPanel';

type SubTabId = 'url-filters' | 'storage' | 'rules' | 'key-bindings' | 'misc';

interface SubTab {
  id: SubTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export const PreferencesPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTabId>('url-filters');

  const subTabs: SubTab[] = [
    {
      id: 'url-filters',
      label: 'URL Filters',
      icon: Filter,
      component: <UrlFilterConfigPanel onConfigChange={(patterns) => console.log('URL filter configuration updated:', patterns)} />
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: HardDrive,
      component: <StorageConfigPanel />
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: Zap,
      component: <RulesConfigPanel onConfigChange={(config) => console.log('Rules configuration updated:', config)} />
    },
    {
      id: 'key-bindings',
      label: 'Key bindings',
      icon: Keyboard,
      component: <KeyBindingsConfigPanel />
    },
    {
      id: 'misc',
      label: 'Misc',
      icon: Settings2,
      component: <MiscConfigPanel />
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab Navigation */}
      <div className="flex border-b mb-6 overflow-x-auto">
        <div className="flex flex-nowrap min-w-full">
          {subTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <IconComponent size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content */}
      <div className="flex-grow">
        {subTabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};
