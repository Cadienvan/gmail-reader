import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { ruleEngineService } from '../services/ruleEngineService';
import type { RuleCondition } from '../types';

interface RuleConditionEditorProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
  logicOperator: 'AND' | 'OR';
  onLogicOperatorChange: (operator: 'AND' | 'OR') => void;
}

export const RuleConditionEditor: React.FC<RuleConditionEditorProps> = ({
  conditions,
  onChange,
  logicOperator,
  onLogicOperatorChange
}) => {
  const [availableConditions] = useState(ruleEngineService.getConditionTypes());

  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'sender_email',
      operator: 'contains',
      value: '',
      caseSensitive: false
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<RuleCondition>) => {
    onChange(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const getOperatorsByConditionType = (conditionType: string): string[] => {
    const conditionDef = availableConditions.find(c => c.type === conditionType);
    return conditionDef?.supportedOperators || ['equals', 'contains'];
  };

  const getOperatorLabel = (operator: string): string => {
    const labels: Record<string, string> = {
      'equals': 'equals',
      'contains': 'contains',
      'starts_with': 'starts with',
      'ends_with': 'ends with',
      'regex_match': 'matches regex',
      'greater_than': 'greater than',
      'less_than': 'less than',
      'exists': 'exists',
      'not_exists': 'does not exist'
    };
    return labels[operator] || operator;
  };

  const getValueInputType = (conditionType: string): 'text' | 'number' | 'checkbox' => {
    const conditionDef = availableConditions.find(c => c.type === conditionType);
    if (conditionDef?.valueType === 'number') return 'number';
    if (conditionDef?.valueType === 'boolean') return 'checkbox';
    return 'text';
  };

  const shouldShowValueInput = (condition: RuleCondition): boolean => {
    return !['exists', 'not_exists'].includes(condition.operator);
  };

  const shouldShowCaseSensitive = (condition: RuleCondition): boolean => {
    const conditionDef = availableConditions.find(c => c.type === condition.type);
    return conditionDef?.valueType === 'string' && 
           ['contains', 'starts_with', 'ends_with', 'regex_match'].includes(condition.operator);
  };

  return (
    <div className="space-y-4">
      {/* Logic Operator Selection */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Conditions logic:</span>
          <div className="flex gap-2">
            <button
              onClick={() => onLogicOperatorChange('AND')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                logicOperator === 'AND'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              AND
            </button>
            <button
              onClick={() => onLogicOperatorChange('OR')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                logicOperator === 'OR'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              OR
            </button>
          </div>
          <div className="ml-2 text-xs text-gray-500">
            {logicOperator === 'AND' 
              ? 'All conditions must be true' 
              : 'At least one condition must be true'}
          </div>
        </div>
      )}

      {/* Conditions List */}
      <div className="space-y-3">
        {conditions.map((condition, index) => {
          const conditionDef = availableConditions.find(c => c.type === condition.type);
          const supportedOperators = getOperatorsByConditionType(condition.type);
          const inputType = getValueInputType(condition.type);

          return (
            <div key={condition.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Condition Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">If</span>
                  {index > 0 && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      logicOperator === 'AND' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {logicOperator}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeCondition(condition.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                  title="Remove condition"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Condition Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Condition Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Field
                  </label>
                  <select
                    value={condition.type}
                    onChange={(e) => updateCondition(condition.id, { 
                      type: e.target.value as any,
                      operator: getOperatorsByConditionType(e.target.value)[0] as any
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {availableConditions.map(condType => (
                      <option key={condType.type} value={condType.type}>
                        {condType.label}
                      </option>
                    ))}
                  </select>
                  {conditionDef && (
                    <p className="text-xs text-gray-500 mt-1">{conditionDef.description}</p>
                  )}
                </div>

                {/* Operator */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Operator
                  </label>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, { operator: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {supportedOperators.map(op => (
                      <option key={op} value={op}>
                        {getOperatorLabel(op)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Value
                  </label>
                  {shouldShowValueInput(condition) ? (
                    inputType === 'checkbox' ? (
                      <div className="flex items-center h-10">
                        <input
                          type="checkbox"
                          checked={Boolean(condition.value)}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type={inputType}
                          value={condition.value as string | number}
                          onChange={(e) => updateCondition(condition.id, { 
                            value: inputType === 'number' ? Number(e.target.value) : e.target.value 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder={
                            condition.type === 'content_regex' || condition.operator === 'regex_match'
                              ? 'Regular expression pattern'
                              : condition.type === 'sender_score'
                              ? '50'
                              : 'Value to match'
                          }
                        />
                        {condition.operator === 'regex_match' && (
                          <div className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Use valid regex syntax. Example: \\bhref=["']([^"']*)["']
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center h-10 text-xs text-gray-500">
                      No value needed for this operator
                    </div>
                  )}
                </div>
              </div>

              {/* Case Sensitivity Option */}
              {shouldShowCaseSensitive(condition) && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`case-${condition.id}`}
                    checked={condition.caseSensitive}
                    onChange={(e) => updateCondition(condition.id, { caseSensitive: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`case-${condition.id}`} className="text-xs text-gray-600">
                    Case sensitive matching
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Condition Button */}
      <button
        onClick={addCondition}
        className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 border-dashed rounded-lg hover:bg-blue-50 transition-colors w-full justify-center"
      >
        <Plus size={16} />
        Add Condition
      </button>

      {/* Help Text */}
      {conditions.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No conditions defined.</p>
          <p className="text-xs mt-1">Add at least one condition to specify when this rule should trigger.</p>
        </div>
      )}
    </div>
  );
};
