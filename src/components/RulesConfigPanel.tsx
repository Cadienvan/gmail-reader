import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Bug,
  Settings,
  Eye,
  EyeOff,
  Calendar,
  Target,
  Zap,
  TrendingUp,
  Archive
} from 'lucide-react';
import { rulesService } from '../services/rulesService';
import { RuleConditionEditor } from './RuleConditionEditor';
import { RuleActionEditor } from './RuleActionEditor';
import type { Rule, RulesConfig } from '../types';
import { Button, IconButton, Input, Textarea, Card, Callout } from './ui';

interface RulesConfigPanelProps {
  onConfigChange?: (config: RulesConfig) => void;
  className?: string;
}

export const RulesConfigPanel: React.FC<RulesConfigPanelProps> = ({
  onConfigChange,
  className = ''
}) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [config, setConfig] = useState<RulesConfig>(rulesService.getConfig());
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'debug' | 'settings'>('rules');

  // Load initial data
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = () => {
    setRules(rulesService.getAllRules());
  };

  const handleCreateRule = () => {
    const newRule: Omit<Rule, 'id' | 'createdAt' | 'lastModified' | 'executionCount'> = {
      name: 'New Rule',
      description: '',
      enabled: false,
      conditions: [],
      actions: [],
      logicOperator: 'AND'
    };
    setEditingRule({ ...newRule, id: 'new', createdAt: Date.now(), lastModified: Date.now(), executionCount: 0 });
    setIsCreatingRule(true);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    try {
      if (isCreatingRule) {
        const { id, createdAt, lastModified, executionCount, ...ruleData } = editingRule;
        rulesService.createRule(ruleData);
      } else {
        const { id, createdAt, ...updates } = editingRule;
        rulesService.updateRule(id, updates);
      }

      loadRules();
      setEditingRule(null);
      setIsCreatingRule(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule. Please check your configuration.');
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsCreatingRule(false);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      rulesService.deleteRule(id);
      loadRules();
    }
  };

  const handleToggleRule = (id: string) => {
    rulesService.toggleRule(id);
    loadRules();
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule({ ...rule });
    setIsCreatingRule(false);
  };

  const handleConfigChange = (updates: Partial<RulesConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    rulesService.setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleExport = () => {
    const exportData = rulesService.exportRules();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gmail-reader-rules-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) {
      alert('Please paste rules JSON data');
      return;
    }

    if (rulesService.importRules(importText)) {
      loadRules();
      setImportText('');
      setShowImport(false);
      alert('Rules imported successfully!');
    } else {
      alert('Failed to import rules. Please check the JSON format.');
    }
  };

  const createExampleRules = () => {
    if (confirm('This will create example rules to demonstrate the system. Continue?')) {
      rulesService.createExampleRules();
      loadRules();
    }
  };

  const clearAllRules = () => {
    if (confirm('Are you sure you want to delete ALL rules? This cannot be undone.')) {
      rulesService.clearAllRules();
      loadRules();
    }
  };

  const debugLogs = rulesService.getDebugLogs();
  const statistics = rulesService.getStatistics();

  // Main edit view
  if (editingRule) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isCreatingRule ? 'Create New Rule' : 'Edit Rule'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Define when and what actions to take for incoming emails
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCancelEdit} variant="secondary" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSaveRule} variant="primary" size="sm">
              {isCreatingRule ? 'Create Rule' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Rule Basic Info */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="Enter a descriptive name for this rule"
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rule-enabled"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="rule-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Rule
                </label>
              </div>
              {!isCreatingRule && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Executed {editingRule.executionCount} times
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <Input
              type="text"
              value={editingRule.description || ''}
              onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
              placeholder="Optional description of what this rule does"
              className="text-sm"
            />
          </div>
        </Card>

        {/* Conditions Section */}
        <Card
          padding="none"
          title={
            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Target size={18} className="text-blue-600" />
              Conditions (When)
            </span>
          }
          description="Define the conditions that must be met for this rule to trigger"
        >
          <div className="p-4">
            <RuleConditionEditor
              conditions={editingRule.conditions}
              onChange={(conditions) => setEditingRule({ ...editingRule, conditions })}
              logicOperator={editingRule.logicOperator}
              onLogicOperatorChange={(logicOperator) => setEditingRule({ ...editingRule, logicOperator })}
            />
          </div>
        </Card>

        {/* Actions Section */}
        <Card
          padding="none"
          title={
            <span className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Zap size={18} className="text-purple-600" />
              Actions (Then)
            </span>
          }
          description="Define what should happen when the conditions are met"
        >
          <div className="p-4">
            <RuleActionEditor
              actions={editingRule.actions}
              onChange={(actions) => setEditingRule({ ...editingRule, actions })}
            />
          </div>
        </Card>

        {/* Validation */}
        <div className="space-y-2">
          {!editingRule.name.trim() && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              Rule name is required
            </div>
          )}
          {editingRule.conditions.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertCircle size={16} />
              At least one condition is recommended
            </div>
          )}
          {editingRule.actions.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertCircle size={16} />
              At least one action is required
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main rules list view
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings size={20} />
            Email Rules
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create "if this then that" automation rules for your emails
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowImport(!showImport)}
            variant="secondary"
            size="sm"
            leftIcon={<Upload size={14} />}
          >
            Import
          </Button>
          <Button
            onClick={handleExport}
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
          >
            Export
          </Button>
          <Button
            onClick={handleCreateRule}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
          >
            Create Rule
          </Button>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <Card>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Import Rules</h4>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste exported rules JSON here..."
            className="text-sm mb-3"
            rows={4}
          />
          <div className="flex gap-2">
            <Button onClick={handleImport} variant="success" size="sm">
              Import
            </Button>
            <Button
              onClick={() => { setShowImport(false); setImportText(''); }}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'rules', label: 'Rules', icon: Settings },
          { id: 'debug', label: 'Debug Log', icon: Bug },
          { id: 'settings', label: 'Settings', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.id === 'debug' && debugLogs.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
                  {debugLogs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Rules</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statistics.totalRules}</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-200">Enabled</span>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{statistics.enabledRules}</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Executions</span>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{statistics.totalExecutions}</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Archive size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200">Debug Logs</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statistics.debugLogsCount}</p>
            </div>
          </div>

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Settings size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Rules Created</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first automation rule to get started with email processing
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCreateRule} variant="primary" size="sm">
                  Create First Rule
                </Button>
                <Button onClick={createExampleRules} variant="secondary" size="sm">
                  Add Example Rules
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    rule.enabled
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{rule.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {rule.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{rule.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</span>
                        <span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
                        <span>Logic: {rule.logicOperator}</span>
                        <span>Executed: {rule.executionCount} times</span>
                        {rule.lastExecuted && (
                          <span>Last: {new Date(rule.lastExecuted).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                      <IconButton
                        onClick={() => handleToggleRule(rule.id)}
                        variant={rule.enabled ? 'ghost' : 'success'}
                        label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        {rule.enabled ? <Pause size={16} /> : <Play size={16} />}
                      </IconButton>

                      <IconButton
                        onClick={() => handleEditRule(rule)}
                        variant="primary"
                        label="Edit rule"
                      >
                        <Edit2 size={16} />
                      </IconButton>

                      <IconButton
                        onClick={() => handleDeleteRule(rule.id)}
                        variant="danger"
                        label="Delete rule"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {rules.length > 0 && (
            <div className="flex gap-2 justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={createExampleRules} variant="secondary" size="sm">
                Add Examples
              </Button>
              <Button
                onClick={clearAllRules}
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'debug' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Rule Execution Debug Log</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track which rules are being triggered and their results
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDebugLog(!showDebugLog)}
                variant="soft"
                size="sm"
                leftIcon={showDebugLog ? <EyeOff size={14} /> : <Eye size={14} />}
              >
                {showDebugLog ? 'Hide Details' : 'Show Details'}
              </Button>
              <Button
                onClick={() => rulesService.clearDebugLogs()}
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
              >
                Clear Log
              </Button>
            </div>
          </div>

          {debugLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Bug size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Debug Logs</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Debug logs will appear here when rules are executed (debug mode must be enabled)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {debugLogs.reverse().map((log) => (
                <Card key={log.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {log.emailSubject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">From:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{log.emailFrom}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{log.totalRulesChecked}</span>
                      <div className="text-gray-600 dark:text-gray-400">Rules Checked</div>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">{log.totalRulesFired}</span>
                      <div className="text-gray-600 dark:text-gray-400">Rules Fired</div>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {log.results.reduce((sum, r) => sum + r.actionResults.length, 0)}
                      </span>
                      <div className="text-gray-600 dark:text-gray-400">Actions Executed</div>
                    </div>
                  </div>

                  {showDebugLog && (
                    <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {log.results.map((result) => (
                        <div key={result.ruleId} className={`p-3 rounded border-l-4 ${
                          result.matched
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{result.ruleName}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-1 rounded ${
                                result.matched
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {result.matched ? 'MATCHED' : 'NO MATCH'}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">{result.executionTime}ms</span>
                            </div>
                          </div>

                          {result.matched && result.actionResults.length > 0 && (
                            <div className="mt-2 text-xs">
                              <strong className="text-gray-900 dark:text-gray-100">Actions:</strong>
                              {result.actionResults.map((actionResult, idx) => (
                                <div key={idx} className={`ml-2 ${
                                  actionResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {actionResult.type}: {actionResult.success ? '✓' : '✗'}
                                  {actionResult.error && ` (${actionResult.error})`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Rules System Configuration</h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700 dark:text-gray-300">Debug Mode</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enable detailed logging of rule execution for troubleshooting
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.debugMode}
                  onChange={(e) => handleConfigChange({ debugMode: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Debug Log Retention (Days)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={config.debugRetentionDays}
                  onChange={(e) => handleConfigChange({ debugRetentionDays: parseInt(e.target.value) || 7 })}
                  className="w-32 text-sm"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  How long to keep debug logs before automatic cleanup
                </p>
              </div>
            </div>
          </Card>

          <Callout variant="warning" icon={<AlertCircle size={20} />}>
            <h4 className="font-medium mb-2">Security Notice</h4>
            <div className="space-y-2">
              <p>
                Rules with JavaScript actions can execute arbitrary code in your browser.
                Only create or import rules from trusted sources.
              </p>
              <p>
                Rules are stored in your browser's local storage and are not synchronized
                across devices or browsers.
              </p>
              <p>
                Always test new rules with debug mode enabled before relying on them
                for important automation.
              </p>
            </div>
          </Callout>
        </div>
      )}
    </div>
  );
};
