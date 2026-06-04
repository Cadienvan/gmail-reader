import React, { useState, useEffect } from 'react';
import { X, Bug, CheckCircle, AlertCircle, Zap, XCircle, ArrowRight } from 'lucide-react';
import { rulesService } from '../services/rulesService';
import type { RulesDebugLog, RuleExecutionResult } from '../types';
import { IconButton, Button } from './ui';

interface RulesDebugFloaterProps {
  onClose: () => void;
}

export const RulesDebugFloater: React.FC<RulesDebugFloaterProps> = ({ onClose }) => {
  const [debugLogs, setDebugLogs] = useState<RulesDebugLog[]>([]);
  const [config, setConfig] = useState(rulesService.getConfig());
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Load initial state
    loadDebugLogs();

    // Poll for config and debug logs changes every 2 seconds
    const interval = setInterval(() => {
      loadDebugLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array to avoid infinite loops

  const loadDebugLogs = () => {
    setDebugLogs(rulesService.getDebugLogs());
    setConfig(rulesService.getConfig());
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getResultColor = (result: RuleExecutionResult) => {
    if (result.matched) {
      return result.actionResults.some(a => !a.success) ? 'text-amber-600' : 'text-green-600';
    }
    return 'text-gray-500';
  };

  const getResultIcon = (result: RuleExecutionResult) => {
    if (result.matched) {
      return result.actionResults.some(a => !a.success) ? AlertCircle : CheckCircle;
    }
    return Zap;
  };

  const getConditionStatusColor = (matched: boolean, hasError: boolean) => {
    if (hasError) return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (matched) return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    return 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  const getActionStatusColor = (success: boolean, hasError: boolean) => {
    if (hasError) return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (success) return 'text-green-700 bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-800';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const renderConditionFlow = (result: RuleExecutionResult) => {
    return (
      <div className="mt-2 space-y-1">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Conditions:</div>
        {result.conditionResults.map((condition, idx) => (
          <div key={`${condition.conditionId}-${idx}`} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${getConditionStatusColor(condition.matched, !!condition.error)}`}>
              {condition.matched ? <CheckCircle size={10} /> : <XCircle size={10} />}
              <span className="capitalize">{condition.type.replace('_', ' ')}</span>
              {condition.error && (
                <span className="text-red-600" title={condition.error}>⚠</span>
              )}
            </div>
            {idx < result.conditionResults.length - 1 && (
              <span className="text-gray-400 dark:text-gray-500 text-xs">
                {result.matched ? '→' : '✕'}
              </span>
            )}
          </div>
        ))}

        {result.matched && result.actionResults.length > 0 && (
          <>
            <div className="flex items-center gap-1 mt-2">
              <ArrowRight size={10} className="text-green-600" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Actions:</span>
            </div>
            {result.actionResults.map((action, idx) => (
              <div key={`${action.actionId}-${idx}`} className="ml-2">
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${getActionStatusColor(action.success, !!action.error)}`}>
                  {action.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  <span className="capitalize">{action.type.replace('_', ' ')}</span>
                  {action.error && (
                    <span className="text-red-600" title={action.error}>⚠</span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  if (!config.debugMode) {
    return (
      <div className="fixed bottom-4 right-4 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg p-3 shadow-lg z-50">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Rules debug mode is disabled
          </span>
          <IconButton
            onClick={onClose}
            label="Close"
            size="sm"
            className="text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40"
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>
    );
  }

  const recentLogs = debugLogs.slice(-5).reverse(); // Show last 5 logs, most recent first

  return (
    <div className={`fixed bottom-4 right-4 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 transition-all duration-200 ${
      isMinimized ? 'w-64' : 'w-[500px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-purple-600" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Rules Debug</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({debugLogs.length} logs)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => setIsMinimized(!isMinimized)}
            label={isMinimized ? 'Expand' : 'Minimize'}
            size="sm"
          >
            <span>{isMinimized ? '↗' : '↙'}</span>
          </IconButton>
          <IconButton
            onClick={onClose}
            label="Close"
            size="sm"
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="max-h-96 overflow-y-auto">
          {recentLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Bug size={24} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              <p className="text-sm">No rules executed yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Debug logs will appear here when rules are triggered
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded p-3 text-xs bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {log.emailSubject}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>

                  <div className="text-gray-600 dark:text-gray-400 mb-3 truncate">
                    From: {log.emailFrom}
                  </div>

                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-gray-600 dark:text-gray-400">
                      {log.totalRulesChecked} rules checked • {log.totalRulesFired} fired
                    </span>
                    <div className="flex items-center gap-1">
                      {log.results.filter(r => r.matched).map((result) => {
                        const Icon = getResultIcon(result);
                        return (
                          <span
                            key={result.ruleId}
                            title={`${result.ruleName}: ${result.matched ? 'Fired' : 'No match'}`}
                          >
                            <Icon
                              size={12}
                              className={getResultColor(result)}
                            />
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Show all rules with detailed flow */}
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                    {log.results.map((result) => (
                      <div
                        key={result.ruleId}
                        className={`border rounded-md p-2 ${
                          result.matched
                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-medium ${
                            result.matched ? 'text-green-800 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {result.ruleName}
                          </span>
                          <div className="flex items-center gap-1">
                            {result.matched ? (
                              <CheckCircle size={12} className="text-green-600" />
                            ) : (
                              <XCircle size={12} className="text-gray-500 dark:text-gray-400" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {result.executionTime}ms
                            </span>
                          </div>
                        </div>

                        {/* Detailed condition and action flow */}
                        {renderConditionFlow(result)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {!isMinimized && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <div className="flex gap-2">
            <Button
              onClick={loadDebugLogs}
              variant="primary"
              size="sm"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                rulesService.clearDebugLogs();
                loadDebugLogs();
              }}
              variant="danger"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
