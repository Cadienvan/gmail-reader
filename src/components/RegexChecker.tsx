import React, { useState, useEffect } from 'react';
import { Plus, TestTube, CheckCircle, AlertCircle, X, Save } from 'lucide-react';
import { urlFilterService } from '../services/urlFilterService';
import type { UrlFilterPattern } from '../types';

interface RegexCheckerProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onPatternAdded?: (pattern: UrlFilterPattern) => void;
}

export const RegexChecker: React.FC<RegexCheckerProps> = ({
  isOpen,
  onClose,
  initialUrl = '',
  onPatternAdded
}) => {
  const [testUrl, setTestUrl] = useState(initialUrl);
  const [newPattern, setNewPattern] = useState({
    name: '',
    pattern: '',
    description: ''
  });
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [validationError, setValidationError] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [patterns, setPatterns] = useState<UrlFilterPattern[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTestUrl(initialUrl);
      setPatterns(urlFilterService.getPatterns());
      if (initialUrl) {
        handleTestUrl(initialUrl);
      }
    }
  }, [isOpen, initialUrl]);

  const handleTestUrl = (urlToTest: string = testUrl) => {
    if (!urlToTest.trim()) return;

    const results = new Map<string, boolean>();
    const currentPatterns = urlFilterService.getPatterns();
    
    currentPatterns.forEach(pattern => {
      if (pattern.enabled) {
        results.set(pattern.id, urlFilterService.testPattern(pattern.pattern, urlToTest));
      }
    });
    setTestResults(results);
  };

  const handlePatternChange = (field: keyof typeof newPattern, value: string) => {
    setNewPattern(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error when user starts typing in pattern field
    if (field === 'pattern') {
      setValidationError('');
    }
  };

  const generatePatternFromUrl = () => {
    if (!testUrl.trim()) return;
    
    try {
      const url = new URL(testUrl);
      const domain = url.hostname.replace(/\./g, '\\.');
      const suggestedPattern = `.*${domain}.*`;
      
      setNewPattern(prev => ({
        ...prev,
        pattern: suggestedPattern,
        name: prev.name || `Filter ${url.hostname}`,
        description: prev.description || `Filter URLs from ${url.hostname}`
      }));
    } catch (error) {
      // For non-URL strings, create a simple contains pattern
      const escapedUrl = testUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setNewPattern(prev => ({
        ...prev,
        pattern: `.*${escapedUrl}.*`,
        name: prev.name || `Filter containing "${testUrl}"`,
        description: prev.description || `Filter URLs containing "${testUrl}"`
      }));
    }
  };

  const handleAddPattern = () => {
    const validation = urlFilterService.validatePattern(newPattern.pattern);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid pattern');
      return;
    }

    if (!newPattern.name.trim() || !newPattern.pattern.trim()) {
      setValidationError('Name and pattern are required');
      return;
    }

    const added = urlFilterService.addPattern({
      name: newPattern.name.trim(),
      pattern: newPattern.pattern.trim(),
      description: newPattern.description.trim(),
      enabled: true
    });

    setPatterns([...patterns, added]);
    setNewPattern({ name: '', pattern: '', description: '' });
    setShowAddForm(false);
    setValidationError('');
    
    // Re-test the URL with the new pattern
    handleTestUrl();
    
    onPatternAdded?.(added);
  };

  const getFilteredCount = () => {
    if (!testUrl.trim()) return 0;
    return Array.from(testResults.values()).filter(Boolean).length;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TestTube size={20} />
            Regex URL Checker
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* URL Test Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">Test URL Against Patterns</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="Enter a URL to test..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => handleTestUrl()}
                  disabled={!testUrl.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Test
                </button>
              </div>
              
              {testUrl && testResults.size > 0 && (
                <div className="p-3 bg-gray-50 border rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    {getFilteredCount() > 0 ? (
                      <>
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-sm font-medium text-red-700">
                          URL would be filtered by {getFilteredCount()} pattern(s)
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-sm font-medium text-green-700">
                          URL would not be filtered
                        </span>
                      </>
                    )}
                  </div>
                  {Array.from(testResults.entries()).some(([_, matches]) => matches) && (
                    <div className="text-xs text-gray-600">
                      Matching patterns: {Array.from(testResults.entries())
                        .filter(([_, matches]) => matches)
                        .map(([id, _]) => patterns.find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Pattern Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">Quick Add Pattern</h4>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                >
                  <Plus size={14} />
                  Add Pattern
                </button>
              )}
            </div>

            {showAddForm ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={generatePatternFromUrl}
                    disabled={!testUrl.trim()}
                    className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Generate from URL
                  </button>
                  <div className="text-xs text-gray-500 flex items-center">
                    Auto-generate a regex pattern to match the test URL
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern Name
                  </label>
                  <input
                    type="text"
                    value={newPattern.name}
                    onChange={(e) => handlePatternChange('name', e.target.value)}
                    placeholder="e.g., Filter Social Media"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Regex Pattern
                  </label>
                  <input
                    type="text"
                    value={newPattern.pattern}
                    onChange={(e) => handlePatternChange('pattern', e.target.value)}
                    placeholder="e.g., .*(facebook|twitter)\.com.*"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-red-600">{validationError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newPattern.description}
                    onChange={(e) => handlePatternChange('description', e.target.value)}
                    placeholder="Description of what this pattern filters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddPattern}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                  >
                    <Save size={16} />
                    Save Pattern
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPattern({ name: '', pattern: '', description: '' });
                      setValidationError('');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Add a new regex pattern to filter URLs. You can auto-generate a pattern from the test URL above.
              </p>
            )}
          </div>

          {/* Current Patterns */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">
              Current Patterns ({patterns.filter(p => p.enabled).length} active)
            </h4>
            {patterns.length === 0 ? (
              <p className="text-sm text-gray-500">No patterns configured.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`p-2 rounded border text-xs ${
                      pattern.enabled ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
                    } ${testResults.get(pattern.id) ? 'ring-2 ring-red-200' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {pattern.name}
                        </div>
                        <code className="text-gray-600 bg-gray-100 px-1 rounded text-xs break-all">
                          {pattern.pattern}
                        </code>
                      </div>
                      {testResults.get(pattern.id) && (
                        <div className="ml-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertCircle size={10} />
                          Match
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Regex patterns are case-insensitive and applied to URLs during extraction.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
