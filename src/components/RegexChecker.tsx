import React, { useState, useEffect } from 'react';
import { Plus, TestTube, CheckCircle, AlertCircle, X, Save } from 'lucide-react';
import { urlFilterService } from '../services/urlFilterService';
import type { UrlFilterPattern } from '../types';
import { Button, Input, Label, Card, Callout, Modal } from './ui';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <TestTube size={20} />
          Regex URL Checker
        </span>
      }
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Regex patterns are case-insensitive and applied to URLs during extraction.
          </span>
          <Button variant="secondary" onClick={onClose} leftIcon={<X size={16} />}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* URL Test Section */}
        <Card>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Test URL Against Patterns</h4>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Enter a URL to test..."
                className="flex-1"
              />
              <Button
                onClick={() => handleTestUrl()}
                disabled={!testUrl.trim()}
                variant="primary"
              >
                Test
              </Button>
            </div>

            {testUrl && testResults.size > 0 && (
              <Callout variant={getFilteredCount() > 0 ? 'danger' : 'success'}>
                <div className="flex items-center gap-2 mb-1">
                  {getFilteredCount() > 0 ? (
                    <>
                      <AlertCircle size={16} />
                      <span className="font-medium">
                        URL would be filtered by {getFilteredCount()} pattern(s)
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span className="font-medium">
                        URL would not be filtered
                      </span>
                    </>
                  )}
                </div>
                {Array.from(testResults.entries()).some(([, matches]) => matches) && (
                  <div className="text-xs mt-1">
                    Matching patterns: {Array.from(testResults.entries())
                      .filter(([, matches]) => matches)
                      .map(([id]) => patterns.find(p => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </Callout>
            )}
          </div>
        </Card>

        {/* Quick Add Pattern Section */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Quick Add Pattern</h4>
            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
              >
                Add Pattern
              </Button>
            )}
          </div>

          {showAddForm ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={generatePatternFromUrl}
                  disabled={!testUrl.trim()}
                  variant="success"
                  size="sm"
                >
                  Generate from URL
                </Button>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  Auto-generate a regex pattern to match the test URL
                </div>
              </div>

              <div>
                <Label>Pattern Name</Label>
                <Input
                  type="text"
                  value={newPattern.name}
                  onChange={(e) => handlePatternChange('name', e.target.value)}
                  placeholder="e.g., Filter Social Media"
                />
              </div>

              <div>
                <Label>Regex Pattern</Label>
                <Input
                  type="text"
                  value={newPattern.pattern}
                  onChange={(e) => handlePatternChange('pattern', e.target.value)}
                  placeholder="e.g., .*(facebook|twitter)\.com.*"
                  mono
                />
                {validationError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationError}</p>
                )}
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Input
                  type="text"
                  value={newPattern.description}
                  onChange={(e) => handlePatternChange('description', e.target.value)}
                  placeholder="Description of what this pattern filters"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddPattern}
                  variant="success"
                  leftIcon={<Save size={16} />}
                >
                  Save Pattern
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPattern({ name: '', pattern: '', description: '' });
                    setValidationError('');
                  }}
                  variant="secondary"
                  leftIcon={<X size={16} />}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add a new regex pattern to filter URLs. You can auto-generate a pattern from the test URL above.
            </p>
          )}
        </Card>

        {/* Current Patterns */}
        <Card>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
            Current Patterns ({patterns.filter(p => p.enabled).length} active)
          </h4>
          {patterns.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No patterns configured.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className={`p-2 rounded border text-xs ${
                    pattern.enabled
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                  } ${testResults.get(pattern.id) ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {pattern.name}
                      </div>
                      <code className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs break-all">
                        {pattern.pattern}
                      </code>
                    </div>
                    {testResults.get(pattern.id) && (
                      <div className="ml-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <AlertCircle size={10} />
                        Match
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Modal>
  );
};
