import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle, Code, ExternalLink, Save, MessageCircle, Mail, Trash, FileText, ChevronRight, ChevronLeft } from 'lucide-react';
import { ruleEngineService } from '../services/ruleEngineService';
import type { RuleAction } from '../types';

interface RuleActionEditorProps {
  actions: RuleAction[];
  onChange: (actions: RuleAction[]) => void;
}

export const RuleActionEditor: React.FC<RuleActionEditorProps> = ({
  actions,
  onChange
}) => {
  const [availableActions] = useState(ruleEngineService.getActionTypes());

  const addAction = () => {
    const newAction: RuleAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'log_message',
      parameters: {},
      description: ''
    };
    onChange([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    onChange(actions.filter(a => a.id !== id));
  };

  const updateAction = (id: string, updates: Partial<RuleAction>) => {
    onChange(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const updateActionParameter = (actionId: string, paramName: string, value: any) => {
    const action = actions.find(a => a.id === actionId);
    if (action) {
      updateAction(actionId, {
        parameters: { ...action.parameters, [paramName]: value }
      });
    }
  };

  const getActionIcon = (actionType: string) => {
    const icons: Record<string, React.ComponentType<{ size?: number }>> = {
      'javascript_code': Code,
      'open_url': ExternalLink,
      'save_variable': Save,
      'log_message': MessageCircle,
      'add_score': Plus,
      'mark_email': Save,
      'notify': AlertCircle,
      'delete_email': Trash,
      'mark_as_read': Mail,
      'request_summary': FileText,
      'goto_next_email': ChevronRight,
      'goto_previous_email': ChevronLeft
    };
    return icons[actionType] || AlertCircle;
  };

  const renderParameterInput = (action: RuleAction, param: any) => {
    const value = action.parameters[param.name] || '';

    switch (param.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateActionParameter(action.id, param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono min-h-[100px]"
            placeholder={param.placeholder}
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateActionParameter(action.id, param.name, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder={param.placeholder}
          />
        );
      
      case 'boolean':
        return (
          <div className="flex items-center h-10">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateActionParameter(action.id, param.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        );
      
      default: // string
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateActionParameter(action.id, param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder={param.placeholder}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions List */}
      <div className="space-y-3">
        {actions.map((action, index) => {
          const actionDef = availableActions.find(a => a.type === action.type);
          const ActionIcon = getActionIcon(action.type);

          return (
            <div key={action.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Action Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Then</span>
                  {index > 0 && (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                      AND
                    </span>
                  )}
                  <span className="text-purple-600">
                    <ActionIcon size={16} />
                  </span>
                </div>
                <button
                  onClick={() => removeAction(action.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                  title="Remove action"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Action Type Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Action Type
                </label>
                <select
                  value={action.type}
                  onChange={(e) => updateAction(action.id, { 
                    type: e.target.value as any,
                    parameters: {} // Reset parameters when changing type
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {availableActions.map(actionType => (
                    <option key={actionType.type} value={actionType.type}>
                      {actionType.label}
                    </option>
                  ))}
                </select>
                {actionDef && (
                  <p className="text-xs text-gray-500 mt-1">{actionDef.description}</p>
                )}
              </div>

              {/* Action Description */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={action.description || ''}
                  onChange={(e) => updateAction(action.id, { description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Describe what this action does..."
                />
              </div>

              {/* Action Parameters */}
              {actionDef?.parameters.map((param) => (
                <div key={param.name} className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {param.label}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderParameterInput(action, param)}
                  <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                  
                  {/* Special help for specific parameter types */}
                  {param.name === 'code' && action.type === 'javascript_code' && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <p className="font-medium text-blue-800 mb-1">Available variables:</p>
                      <ul className="text-blue-700 space-y-0.5">
                        <li>• <code>email</code> - Email object with id, subject, from, body, etc.</li>
                        <li>• <code>senderInfo</code> - Object with email and name</li>
                        <li>• <code>extractedLinks</code> - Array of links found in email</li>
                        <li>• <code>senderScore</code> - Current sender quality score</li>
                        <li>• <code>variables</code> - Variables saved by previous actions</li>
                        <li>• <code>console</code> - For logging (console.log, console.error)</li>
                        <li>• <code>window</code> - Limited window object (window.open)</li>
                        <li>• <code>utils</code> - Utility functions (utils.extractRegex)</li>
                      </ul>
                    </div>
                  )}
                  
                  {param.name === 'regexPattern' && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                      <p className="font-medium text-amber-800 mb-1">Regex Examples:</p>
                      <ul className="text-amber-700 space-y-0.5">
                        <li>• <code>href=["']([^"']*)["]</code> - Extract href URLs</li>
                        <li>• <code>https?://([^/]+)</code> - Extract domain from URLs</li>
                        <li>• <code>(\\d+)</code> - Extract numbers</li>
                      </ul>
                    </div>
                  )}
                  
                  {(param.name === 'message' || param.name === 'url' || param.name === 'body' || param.name === 'title') && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                      <p className="font-medium text-green-800 mb-1">Variable substitution:</p>
                      <ul className="text-green-700 space-y-0.5">
                        <li>• <code>${'${email.subject}'}</code> - Email subject</li>
                        <li>• <code>${'${senderInfo.email}'}</code> - Sender email</li>
                        <li>• <code>${'${senderInfo.name}'}</code> - Sender name</li>
                        <li>• <code>${'${senderScore}'}</code> - Sender score</li>
                        <li>• <code>${'${variables.variableName}'}</code> - Custom variables</li>
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {/* Validation Warnings */}
              {actionDef && (
                <div className="space-y-2">
                  {actionDef.parameters
                    .filter(p => p.required && !action.parameters[p.name])
                    .map(p => (
                      <div key={p.name} className="flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle size={12} />
                        <span>Required field "{p.label}" is empty</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Action Button */}
      <button
        onClick={addAction}
        className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-300 border-dashed rounded-lg hover:bg-purple-50 transition-colors w-full justify-center"
      >
        <Plus size={16} />
        Add Action
      </button>

      {/* Help Text */}
      {actions.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No actions defined.</p>
          <p className="text-xs mt-1">Add at least one action to specify what should happen when conditions are met.</p>
        </div>
      )}

      {/* Action Examples */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Common Action Examples:</h4>
        <div className="space-y-2 text-sm text-blue-800">
          <div>
            <strong>Log high-scoring emails:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Log Message: <code>High scorer: ${'${senderInfo.name}'} (${'${senderScore}'} pts) - ${'${email.subject}'}</code></li>
            </ol>
          </div>
          <div>
            <strong>Notify about newsletters:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Browser Notification: Title "Newsletter", Body "From ${'${senderInfo.name}'}: ${'${email.subject}'}"</li>
            </ol>
          </div>
          <div>
            <strong>Auto-delete spam emails:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Delete Email: Automatically delete emails that match spam criteria</li>
            </ol>
          </div>
          <div>
            <strong>Mark newsletters as read:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Mark as Read: Automatically mark newsletter emails as read</li>
            </ol>
          </div>
          <div>
            <strong>Auto-summarize important emails:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Request Summary: Generate summary or save for later based on mode setting</li>
            </ol>
          </div>
          <div>
            <strong>Skip low-quality emails:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Go to Next Email: Skip to the next email when quality is low</li>
            </ol>
          </div>
          <div>
            <strong>Review important emails:</strong>
            <ol className="ml-4 mt-1 list-decimal list-inside text-xs">
              <li>Go to Previous Email: Return to previous email for important senders</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
