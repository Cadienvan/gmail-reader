import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  Upload,
  RotateCcw,
  TestTube
} from 'lucide-react';
import { urlFilterService } from '../services/urlFilterService';
import type { UrlFilterPattern, UrlFilterConfigPanelProps } from '../types';
import { Button, IconButton, Input, Label, Card, Callout } from './ui';

export const UrlFilterConfigPanel: React.FC<UrlFilterConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [patterns, setPatterns] = useState<UrlFilterPattern[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState({
    name: '',
    pattern: '',
    description: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const config = urlFilterService.getConfig();
    setPatterns(config.patterns);
    setIsEnabled(config.enabled);
  };

  const handleToggleEnabled = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    urlFilterService.setEnabled(newEnabled);
    onConfigChange?.(patterns);
  };

  const handleAddPattern = () => {
    const validation = urlFilterService.validatePattern(newPattern.pattern);
    if (!validation.isValid) {
      setValidationErrors(prev => new Map(prev).set('new', validation.error || 'Invalid pattern'));
      return;
    }

    if (!newPattern.name.trim() || !newPattern.pattern.trim()) {
      setValidationErrors(prev => new Map(prev).set('new', 'Name and pattern are required'));
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
    setValidationErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete('new');
      return newMap;
    });
    onConfigChange?.(patterns);
  };

  const handleUpdatePattern = (id: string, updates: Partial<UrlFilterPattern>) => {
    if (updates.pattern) {
      const validation = urlFilterService.validatePattern(updates.pattern);
      if (!validation.isValid) {
        setValidationErrors(prev => new Map(prev).set(id, validation.error || 'Invalid pattern'));
        return;
      }
    }

    urlFilterService.updatePattern(id, updates);
    setPatterns(patterns.map(p => p.id === id ? { ...p, ...updates, lastModified: new Date() } : p));
    setEditingPattern(null);
    setValidationErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    onConfigChange?.(patterns);
  };

  const handleDeletePattern = (id: string) => {
    if (confirm('Are you sure you want to delete this filter pattern?')) {
      urlFilterService.deletePattern(id);
      setPatterns(patterns.filter(p => p.id !== id));
      onConfigChange?.(patterns);
    }
  };

  const handleTestUrl = () => {
    if (!testUrl.trim()) return;

    const results = new Map<string, boolean>();
    patterns.forEach(pattern => {
      if (pattern.enabled) {
        results.set(pattern.id, urlFilterService.testPattern(pattern.pattern, testUrl));
      }
    });
    setTestResults(results);
  };

  const handleResetToDefaults = () => {
    if (confirm('Are you sure you want to reset to default filter patterns? This will remove all custom patterns.')) {
      urlFilterService.resetToDefaults();
      loadConfig();
      onConfigChange?.(patterns);
    }
  };

  const handleExportPatterns = () => {
    const patterns = urlFilterService.exportPatterns();
    const blob = new Blob([JSON.stringify(patterns, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'url-filter-patterns.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPatterns = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          urlFilterService.importPatterns(imported);
          loadConfig();
          onConfigChange?.(patterns);
        } else {
          alert('Invalid file format. Expected an array of patterns.');
        }
      } catch (error) {
        alert('Failed to import patterns. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
  };

  const getFilteredCount = () => {
    if (!testUrl.trim()) return 0;
    return Array.from(testResults.values()).filter(Boolean).length;
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">URL Filter Configuration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create regex patterns to filter URLs from email analysis and link lists
            </p>
          </div>
          <Button
            onClick={handleToggleEnabled}
            variant={isEnabled ? 'success' : 'secondary'}
            leftIcon={isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          >
            {isEnabled ? 'Filtering Enabled' : 'Filtering Disabled'}
          </Button>
        </div>

        {/* URL Test Section */}
        <Card>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <TestTube size={16} />
            Test URL Against Patterns
          </h4>
          <div className="flex gap-2">
            <Input
              type="url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="Enter a URL to test against all patterns..."
              className="flex-1"
            />
            <Button
              onClick={handleTestUrl}
              disabled={!testUrl.trim()}
              variant="primary"
            >
              Test
            </Button>
          </div>
          {testUrl && testResults.size > 0 && (
            <div className="mt-3">
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
                      .join(', ')}
                  </div>
                )}
              </Callout>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setShowAddForm(true)}
            variant="primary"
            leftIcon={<Plus size={16} />}
          >
            Add Pattern
          </Button>
          <Button
            onClick={handleResetToDefaults}
            variant="secondary"
            leftIcon={<RotateCcw size={16} />}
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={handleExportPatterns}
            variant="secondary"
            leftIcon={<Download size={16} />}
          >
            Export
          </Button>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-green-500">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportPatterns}
              className="hidden"
            />
          </label>
        </div>

        {/* Add Pattern Form */}
        {showAddForm && (
          <Card>
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Filter Pattern</h4>
            <div className="space-y-3">
              <div>
                <Label>Pattern Name</Label>
                <Input
                  type="text"
                  value={newPattern.name}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Social Media Links"
                />
              </div>
              <div>
                <Label>Regex Pattern</Label>
                <Input
                  type="text"
                  value={newPattern.pattern}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, pattern: e.target.value }))}
                  placeholder="e.g., .*(facebook|twitter|instagram)\.com.*"
                  mono
                />
                {validationErrors.has('new') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.get('new')}</p>
                )}
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  type="text"
                  value={newPattern.description}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, description: e.target.value }))}
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
                    setValidationErrors(prev => {
                      const newMap = new Map(prev);
                      newMap.delete('new');
                      return newMap;
                    });
                  }}
                  variant="secondary"
                  leftIcon={<X size={16} />}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Patterns List */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">
            Filter Patterns ({patterns.length})
          </h4>
          {patterns.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No filter patterns configured.</p>
              <p className="text-sm mt-1">Click "Add Pattern" to create your first filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {patterns.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  pattern={pattern}
                  isEditing={editingPattern === pattern.id}
                  testResult={testResults.get(pattern.id)}
                  validationError={validationErrors.get(pattern.id)}
                  onEdit={() => setEditingPattern(pattern.id)}
                  onSave={(updates) => handleUpdatePattern(pattern.id, updates)}
                  onCancel={() => {
                    setEditingPattern(null);
                    setValidationErrors(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(pattern.id);
                      return newMap;
                    });
                  }}
                  onDelete={() => handleDeletePattern(pattern.id)}
                  onToggle={(enabled) => handleUpdatePattern(pattern.id, { enabled })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PatternCardProps {
  pattern: UrlFilterPattern;
  isEditing: boolean;
  testResult?: boolean;
  validationError?: string;
  onEdit: () => void;
  onSave: (updates: Partial<UrlFilterPattern>) => void;
  onCancel: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}

const PatternCard: React.FC<PatternCardProps> = ({
  pattern,
  isEditing,
  testResult,
  validationError,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onToggle
}) => {
  const [editForm, setEditForm] = useState({
    name: pattern.name,
    pattern: pattern.pattern,
    description: pattern.description
  });

  useEffect(() => {
    if (isEditing) {
      setEditForm({
        name: pattern.name,
        pattern: pattern.pattern,
        description: pattern.description
      });
    }
  }, [isEditing, pattern]);

  const handleSave = () => {
    if (!editForm.name.trim() || !editForm.pattern.trim()) {
      return;
    }

    const validation = urlFilterService.validatePattern(editForm.pattern);
    if (!validation.isValid) {
      return;
    }

    onSave({
      name: editForm.name.trim(),
      pattern: editForm.pattern.trim(),
      description: editForm.description.trim()
    });
  };

  if (isEditing) {
    return (
      <Card>
        <div className="space-y-3">
          <div>
            <Label>Pattern Name</Label>
            <Input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Regex Pattern</Label>
            <Input
              type="text"
              value={editForm.pattern}
              onChange={(e) => setEditForm(prev => ({ ...prev, pattern: e.target.value }))}
              mono
            />
            {validationError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationError}</p>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              variant="success"
              size="sm"
              leftIcon={<Save size={16} />}
            >
              Save
            </Button>
            <Button
              onClick={onCancel}
              variant="secondary"
              size="sm"
              leftIcon={<X size={16} />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={`border rounded-lg p-4 transition-colors bg-white dark:bg-gray-800/50 ${
      pattern.enabled
        ? 'border-gray-200 dark:border-gray-700'
        : 'border-gray-300 dark:border-gray-600'
    } ${!pattern.enabled ? 'opacity-60' : ''} ${testResult !== undefined ? (testResult ? 'ring-2 ring-red-200 dark:ring-red-800' : '') : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h5 className={`font-medium truncate ${
              pattern.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {pattern.name}
            </h5>
            {testResult !== undefined && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                testResult
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {testResult ? (
                  <>
                    <AlertCircle size={12} />
                    Matches
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} />
                    No match
                  </>
                )}
              </div>
            )}
          </div>
          <code className={`text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded break-all ${
            pattern.enabled ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {pattern.pattern}
          </code>
          {pattern.description && (
            <p className={`text-sm mt-2 ${
              pattern.enabled ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
            }`}>
              {pattern.description}
            </p>
          )}
          <div className={`text-xs mt-2 ${
            pattern.enabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
          }`}>
            Created: {pattern.createdAt.toLocaleDateString()} •
            Modified: {pattern.lastModified.toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <IconButton
            onClick={() => onToggle(!pattern.enabled)}
            variant={pattern.enabled ? 'success' : 'ghost'}
            label={pattern.enabled ? 'Disable pattern' : 'Enable pattern'}
          >
            {pattern.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
          <IconButton
            onClick={onEdit}
            variant="primary"
            label="Edit pattern"
          >
            <Edit size={16} />
          </IconButton>
          <IconButton
            onClick={onDelete}
            variant="danger"
            label="Delete pattern"
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
