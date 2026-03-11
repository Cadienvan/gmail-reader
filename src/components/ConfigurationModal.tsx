import React, { useState } from 'react';
import { X, Key, Cpu, Settings, Sparkles } from 'lucide-react';
import { GempestConfigPanel } from "./GempestConfigPanel";
import { OAuthPanel } from './OAuthPanel';
import { LocalAIConfigPanel } from './LocalAIConfigPanel';
import { PreferencesPanel } from './PreferencesPanel';
import { environmentConfigService } from '../services/environmentConfigService';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type TabId = 'oauth' | 'local-ai' | 'preferences' | 'gempest';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({
  isOpen,
  onClose,
  initialTab
}) => {
  // Determine the best default tab based on configuration status
  const getDefaultTab = (): TabId => {
    if (initialTab) return initialTab as TabId;
    
    // If OAuth is not configured, start with OAuth setup
    const isConfigured = environmentConfigService.isConfigurationComplete();
    return isConfigured ? 'oauth' : 'oauth';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getDefaultTab);

  const tabs: Tab[] = [
    {
      id: 'oauth',
      label: 'OAuth',
      icon: Key,
      component: <OAuthPanel />
    },
    {
      id: 'local-ai',
      label: 'Local AI',
      icon: Cpu,
      component: <LocalAIConfigPanel />
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: Settings,
      component: <PreferencesPanel />
    },
    {
      id: "gempest",
      label: "Gempest",
      icon: Sparkles,
      component: (
        <GempestConfigPanel />
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          <div className="flex flex-nowrap min-w-full">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
};
