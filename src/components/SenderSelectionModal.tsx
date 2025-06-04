import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Users, 
  Mail, 
  Calendar,
  FileText,
  Link as LinkIcon,
  Shuffle,
  CheckSquare,
  Square
} from 'lucide-react';
import type { SenderSelectionModalProps, SenderSelectionConfig, EmailSender } from '../types';

export const SenderSelectionModal: React.FC<SenderSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  senders,
  isLoading = false,
  title = 'Select Senders for Deep Analysis'
}) => {
  const [senderConfigs, setSenderConfigs] = useState<SenderSelectionConfig[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Initialize sender configs when modal opens or senders change
  useEffect(() => {
    if (isOpen && senders.length > 0) {
      const configs: SenderSelectionConfig[] = senders.map(sender => ({
        email: sender.email,
        name: sender.name,
        include: true, // Default to include all
        contentType: 'mixed', // Default content type
        emailCount: sender.emailCount,
        lastEmailDate: sender.lastEmailDate,
        sampleSubjects: sender.sampleSubjects
      }));
      setSenderConfigs(configs);
      setSelectAll(true);
    }
  }, [isOpen, senders]);

  // Update select all state when individual selections change
  useEffect(() => {
    const allSelected = senderConfigs.length > 0 && senderConfigs.every(config => config.include);
    const noneSelected = senderConfigs.every(config => !config.include);
    setSelectAll(allSelected);
  }, [senderConfigs]);

  const handleSenderToggle = (email: string) => {
    setSenderConfigs(prev => 
      prev.map(config => 
        config.email === email 
          ? { ...config, include: !config.include }
          : config
      )
    );
  };

  const handleContentTypeChange = (email: string, contentType: 'full-text' | 'links-only' | 'mixed') => {
    setSenderConfigs(prev => 
      prev.map(config => 
        config.email === email 
          ? { ...config, contentType }
          : config
      )
    );
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSenderConfigs(prev => 
      prev.map(config => ({ ...config, include: newSelectAll }))
    );
    setSelectAll(newSelectAll);
  };

  const handleSelectNone = () => {
    setSenderConfigs(prev => 
      prev.map(config => ({ ...config, include: false }))
    );
    setSelectAll(false);
  };

  const handleConfirm = () => {
    const selectedConfigs = senderConfigs.filter(config => config.include);
    onConfirm(selectedConfigs);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'full-text':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'links-only':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'mixed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const selectedCount = senderConfigs.filter(config => config.include).length;
  const totalEmails = senderConfigs
    .filter(config => config.include)
    .reduce((sum, config) => sum + config.emailCount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-purple-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Choose which senders to include and specify their content type
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Controls */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <CheckSquare size={14} />
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  <Square size={14} />
                  Select None
                </button>
              </div>
              <div className="text-sm text-gray-600">
                {selectedCount} of {senderConfigs.length} senders selected • {totalEmails} emails total
              </div>
            </div>
          </div>

          {/* Senders List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading senders...</p>
                </div>
              </div>
            ) : senderConfigs.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No senders found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {senderConfigs.map((config) => (
                  <div
                    key={config.email}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.include 
                        ? 'border-purple-200 bg-purple-50' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleSenderToggle(config.email)}
                        className={`mt-1 p-1 rounded transition-colors ${
                          config.include 
                            ? 'text-purple-600 hover:text-purple-700' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {config.include ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>

                      {/* Sender Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {config.name || config.email}
                            </h3>
                            {config.name && (
                              <p className="text-sm text-gray-600 truncate">{config.email}</p>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-500 ml-4">
                            <div className="flex items-center gap-1">
                              <Mail size={12} />
                              {config.emailCount} emails
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Calendar size={12} />
                              {formatDate(config.lastEmailDate)}
                            </div>
                          </div>
                        </div>

                        {/* Content Type Selection */}
                        {config.include && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Content Type:
                            </label>
                            <div className="flex gap-2">
                              {[
                                { value: 'full-text', label: 'Full Text', icon: FileText },
                                { value: 'links-only', label: 'Links Only', icon: LinkIcon },
                                { value: 'mixed', label: 'Mixed', icon: Shuffle }
                              ].map(({ value, label, icon: Icon }) => (
                                <button
                                  key={value}
                                  onClick={() => handleContentTypeChange(config.email, value as any)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                                    config.contentType === value
                                      ? getContentTypeColor(value)
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <Icon size={14} />
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sample Subjects */}
                        {config.sampleSubjects.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Recent subjects:
                            </label>
                            <div className="text-xs text-gray-600 space-y-1">
                              {config.sampleSubjects.slice(0, 3).map((subject, index) => (
                                <div key={index} className="truncate">
                                  • {subject}
                                </div>
                              ))}
                              {config.sampleSubjects.length > 3 && (
                                <div className="text-gray-400">
                                  +{config.sampleSubjects.length - 3} more...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedCount > 0 ? (
                <>
                  <span className="font-medium">{selectedCount}</span> senders selected for analysis
                  <span className="mx-2">•</span>
                  <span className="font-medium">{totalEmails}</span> emails to process
                </>
              ) : (
                'No senders selected'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedCount === 0 || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check size={16} />
                Start Analysis ({selectedCount} senders)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
