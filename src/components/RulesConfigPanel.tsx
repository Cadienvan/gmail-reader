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
            <h3 className="text-lg font-semibold text-gray-900">
              {isCreatingRule ? 'Create New Rule' : 'Edit Rule'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Define when and what actions to take for incoming emails
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRule}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              {isCreatingRule ? 'Create Rule' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Rule Basic Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Enter a descriptive name for this rule"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rule-enabled"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="rule-enabled" className="text-sm font-medium text-gray-700">
                  Enable Rule
                </label>
              </div>
              {!isCreatingRule && (
                <div className="text-xs text-gray-500">
                  Executed {editingRule.executionCount} times
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={editingRule.description || ''}
              onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Optional description of what this rule does"
            />
          </div>
        </div>

        {/* Conditions Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Target size={18} className="text-blue-600" />
              Conditions (When)
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Define the conditions that must be met for this rule to trigger
            </p>
          </div>
          <div className="p-4">
            <RuleConditionEditor
              conditions={editingRule.conditions}
              onChange={(conditions) => setEditingRule({ ...editingRule, conditions })}
              logicOperator={editingRule.logicOperator}
              onLogicOperatorChange={(logicOperator) => setEditingRule({ ...editingRule, logicOperator })}
            />
          </div>
        </div>

        {/* Actions Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Zap size={18} className="text-purple-600" />
              Actions (Then)
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Define what should happen when the conditions are met
            </p>
          </div>
          <div className="p-4">
            <RuleActionEditor
              actions={editingRule.actions}
              onChange={(actions) => setEditingRule({ ...editingRule, actions })}
            />
          </div>
        </div>

        {/* Validation */}
        <div className="space-y-2">
          {!editingRule.name.trim() && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              Rule name is required
            </div>
          )}
          {editingRule.conditions.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle size={16} />
              At least one condition is recommended
            </div>
          )}
          {editingRule.actions.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
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
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings size={20} />
            Email Rules
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Create "if this then that" automation rules for your emails
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={handleCreateRule}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Plus size={16} />
            Create Rule
          </button>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Import Rules</h4>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste exported rules JSON here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-24 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Import
            </button>
            <button
              onClick={() => { setShowImport(false); setImportText(''); }}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
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
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Total Rules</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{statistics.totalRules}</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-900">Enabled</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{statistics.enabledRules}</p>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Executions</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{statistics.totalExecutions}</p>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Archive size={16} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-900">Debug Logs</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{statistics.debugLogsCount}</p>
            </div>
          </div>

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <Settings size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Rules Created</h3>
              <p className="text-gray-600 mb-4">
                Create your first automation rule to get started with email processing
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleCreateRule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Create First Rule
                </button>
                <button
                  onClick={createExampleRules}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  Add Example Rules
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    rule.enabled 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.enabled 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      
                      {rule.description && (
                        <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
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
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={`p-2 rounded transition-colors ${
                          rule.enabled
                            ? 'text-amber-600 hover:bg-amber-100'
                            : 'text-green-600 hover:bg-green-100'
                        }`}
                        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        {rule.enabled ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Edit rule"
                      >
                        <Edit2 size={16} />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {rules.length > 0 && (
            <div className="flex gap-2 justify-center pt-4 border-t border-gray-200">
              <button
                onClick={createExampleRules}
                className="px-3 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
              >
                Add Examples
              </button>
              <button
                onClick={clearAllRules}
                className="px-3 py-2 text-red-700 bg-red-100 rounded-md hover:bg-red-200 text-sm"
              >
                <Trash2 size={14} className="inline mr-1" />
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'debug' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">Rule Execution Debug Log</h4>
              <p className="text-sm text-gray-600">
                Track which rules are being triggered and their results
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDebugLog(!showDebugLog)}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                {showDebugLog ? <EyeOff size={14} /> : <Eye size={14} />}
                {showDebugLog ? 'Hide Details' : 'Show Details'}
              </button>
              <button
                onClick={() => rulesService.clearDebugLogs()}
                className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                <Trash2 size={14} />
                Clear Log
              </button>
            </div>
          </div>

          {debugLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <Bug size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Debug Logs</h3>
              <p className="text-gray-600">
                Debug logs will appear here when rules are executed (debug mode must be enabled)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {debugLogs.reverse().map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {log.emailSubject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium">{log.emailFrom}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-600">{log.totalRulesChecked}</span>
                      <div className="text-gray-600">Rules Checked</div>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-green-600">{log.totalRulesFired}</span>
                      <div className="text-gray-600">Rules Fired</div>
                    </div>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-purple-600">
                        {log.results.reduce((sum, r) => sum + r.actionResults.length, 0)}
                      </span>
                      <div className="text-gray-600">Actions Executed</div>
                    </div>
                  </div>

                  {showDebugLog && (
                    <div className="space-y-2 pt-3 border-t border-gray-200">
                      {log.results.map((result) => (
                        <div key={result.ruleId} className={`p-3 rounded border-l-4 ${
                          result.matched 
                            ? 'bg-green-50 border-green-400' 
                            : 'bg-gray-50 border-gray-300'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{result.ruleName}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-1 rounded ${
                                result.matched 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {result.matched ? 'MATCHED' : 'NO MATCH'}
                              </span>
                              <span className="text-gray-500">{result.executionTime}ms</span>
                            </div>
                          </div>
                          
                          {result.matched && result.actionResults.length > 0 && (
                            <div className="mt-2 text-xs">
                              <strong>Actions:</strong>
                              {result.actionResults.map((actionResult, idx) => (
                                <div key={idx} className={`ml-2 ${
                                  actionResult.success ? 'text-green-600' : 'text-red-600'
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Rules System Configuration</h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">Debug Mode</label>
                  <p className="text-sm text-gray-600">
                    Enable detailed logging of rule execution for troubleshooting
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.debugMode}
                  onChange={(e) => handleConfigChange({ debugMode: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Debug Log Retention (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.debugRetentionDays}
                  onChange={(e) => handleConfigChange({ debugRetentionDays: parseInt(e.target.value) || 7 })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-sm text-gray-600 mt-1">
                  How long to keep debug logs before automatic cleanup
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900 mb-2">Security Notice</h4>
                <div className="text-sm text-amber-800 space-y-2">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
