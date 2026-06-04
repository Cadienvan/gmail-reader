import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { ruleEngineService } from '../services/ruleEngineService';
import type { RuleCondition } from '../types';
import { Button, IconButton, Input, Select, Label } from './ui';

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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conditions logic:</span>
          <div className="flex gap-2">
            <Button
              onClick={() => onLogicOperatorChange('AND')}
              variant={logicOperator === 'AND' ? 'primary' : 'secondary'}
              size="sm"
            >
              AND
            </Button>
            <Button
              onClick={() => onLogicOperatorChange('OR')}
              variant={logicOperator === 'OR' ? 'primary' : 'secondary'}
              size="sm"
            >
              OR
            </Button>
          </div>
          <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">
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
            <div key={condition.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              {/* Condition Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">If</span>
                  {index > 0 && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      logicOperator === 'AND'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {logicOperator}
                    </span>
                  )}
                </div>
                <IconButton
                  onClick={() => removeCondition(condition.id)}
                  variant="danger"
                  size="sm"
                  label="Remove condition"
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>

              {/* Condition Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Condition Type */}
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select
                    value={condition.type}
                    onChange={(e) => updateCondition(condition.id, {
                      type: e.target.value as any,
                      operator: getOperatorsByConditionType(e.target.value)[0] as any
                    })}
                    className="text-sm"
                  >
                    {availableConditions.map(condType => (
                      <option key={condType.type} value={condType.type}>
                        {condType.label}
                      </option>
                    ))}
                  </Select>
                  {conditionDef && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{conditionDef.description}</p>
                  )}
                </div>

                {/* Operator */}
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, { operator: e.target.value as any })}
                    className="text-sm"
                  >
                    {supportedOperators.map(op => (
                      <option key={op} value={op}>
                        {getOperatorLabel(op)}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Value */}
                <div>
                  <Label className="text-xs">Value</Label>
                  {shouldShowValueInput(condition) ? (
                    inputType === 'checkbox' ? (
                      <div className="flex items-center h-10">
                        <input
                          type="checkbox"
                          checked={Boolean(condition.value)}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.checked })}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type={inputType}
                          value={condition.value as string | number}
                          onChange={(e) => updateCondition(condition.id, {
                            value: inputType === 'number' ? Number(e.target.value) : e.target.value
                          })}
                          className="text-sm"
                          placeholder={
                            condition.type === 'content_regex' || condition.operator === 'regex_match'
                              ? 'Regular expression pattern'
                              : 'Value to match'
                          }
                          mono={condition.type === 'content_regex' || condition.operator === 'regex_match'}
                        />
                        {condition.operator === 'regex_match' && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Use valid regex syntax. Example: \\bhref=["']([^"']*)["']
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center h-10 text-xs text-gray-500 dark:text-gray-400">
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
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`case-${condition.id}`} className="text-xs text-gray-600 dark:text-gray-400">
                    Case sensitive matching
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Condition Button */}
      <Button
        onClick={addCondition}
        variant="ghost"
        fullWidth
        leftIcon={<Plus size={16} />}
        className="border border-blue-300 dark:border-blue-700 border-dashed text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        Add Condition
      </Button>

      {/* Help Text */}
      {conditions.length === 0 && (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <AlertCircle size={24} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
          <p className="text-sm">No conditions defined.</p>
          <p className="text-xs mt-1">Add at least one condition to specify when this rule should trigger.</p>
        </div>
      )}
    </div>
  );
};
