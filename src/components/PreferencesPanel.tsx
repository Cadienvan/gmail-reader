import React, { useState } from 'react';
import { Filter, HardDrive, Trophy, Zap, Settings2 } from 'lucide-react';
import { UrlFilterConfigPanel } from './UrlFilterConfigPanel';
import { StorageConfigPanel } from './StorageConfigPanel';
import { EmailScoringDashboard } from './EmailScoringDashboard';
import { RulesConfigPanel } from './RulesConfigPanel';
import { MiscConfigPanel } from './MiscConfigPanel';

type SubTabId = 'url-filters' | 'storage' | 'scoring' | 'rules' | 'misc';

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
      id: 'scoring',
      label: 'Email Scoring',
      icon: Trophy,
      component: <EmailScoringDashboard />
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: Zap,
      component: <RulesConfigPanel onConfigChange={(config) => console.log('Rules configuration updated:', config)} />
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
      </div>

      {/* Sub-tab Content */}
      <div className="flex-grow">
        {subTabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};
