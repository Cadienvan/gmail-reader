import type { Rule, RulesConfig, RulesDebugLog, RuleExecutionResult } from '../types';

class RulesService {
  private readonly STORAGE_KEY = 'gmail-reader-rules';
  private readonly CONFIG_KEY = 'gmail-reader-rules-config';
  private readonly DEBUG_LOG_KEY = 'gmail-reader-rules-debug-log';

  /**
   * Get all rules
   */
  getAllRules(): Rule[] {
    try {
      const rulesData = localStorage.getItem(this.STORAGE_KEY);
      return rulesData ? JSON.parse(rulesData) : [];
    } catch (error) {
      console.error('Failed to load rules:', error);
      return [];
    }
  }

  /**
   * Get enabled rules only
   */
  getEnabledRules(): Rule[] {
    return this.getAllRules().filter(rule => rule.enabled);
  }

  /**
   * Get a specific rule by ID
   */
  getRule(id: string): Rule | null {
    const rules = this.getAllRules();
    return rules.find(rule => rule.id === id) || null;
  }

  /**
   * Create a new rule
   */
  createRule(ruleData: Omit<Rule, 'id' | 'createdAt' | 'lastModified' | 'executionCount'>): Rule {
    const newRule: Rule = {
      ...ruleData,
      id: this.generateRuleId(),
      createdAt: Date.now(),
      lastModified: Date.now(),
      executionCount: 0
    };

    const rules = this.getAllRules();
    rules.push(newRule);
    this.saveRules(rules);
    
    console.log('Created new rule:', newRule.name);
    return newRule;
  }

  /**
   * Update an existing rule
   */
  updateRule(id: string, updates: Partial<Omit<Rule, 'id' | 'createdAt'>>): Rule | null {
    const rules = this.getAllRules();
    const ruleIndex = rules.findIndex(rule => rule.id === id);
    
    if (ruleIndex === -1) {
      console.error('Rule not found:', id);
      return null;
    }

    rules[ruleIndex] = {
      ...rules[ruleIndex],
      ...updates,
      lastModified: Date.now()
    };

    this.saveRules(rules);
    console.log('Updated rule:', rules[ruleIndex].name);
    return rules[ruleIndex];
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    const rules = this.getAllRules();
    const filteredRules = rules.filter(rule => rule.id !== id);
    
    if (filteredRules.length === rules.length) {
      console.error('Rule not found for deletion:', id);
      return false;
    }

    this.saveRules(filteredRules);
    console.log('Deleted rule:', id);
    return true;
  }

  /**
   * Toggle rule enabled status
   */
  toggleRule(id: string): Rule | null {
    const rule = this.getRule(id);
    if (!rule) return null;

    return this.updateRule(id, { enabled: !rule.enabled });
  }

  /**
   * Record rule execution
   */
  recordRuleExecution(ruleId: string, executionTime: number): void {
    const rule = this.getRule(ruleId);
    if (rule) {
      this.updateRule(ruleId, {
        executionCount: rule.executionCount + 1,
        lastExecuted: executionTime
      });
    }
  }

  /**
   * Get rules configuration
   */
  getConfig(): RulesConfig {
    try {
      const configData = localStorage.getItem(this.CONFIG_KEY);
      return configData ? JSON.parse(configData) : this.getDefaultConfig();
    } catch (error) {
      console.error('Failed to load rules config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update rules configuration
   */
  setConfig(config: RulesConfig): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
      console.log('Rules configuration updated');
    } catch (error) {
      console.error('Failed to save rules config:', error);
    }
  }

  /**
   * Log rule execution for debug purposes
   */
  logRuleExecution(emailId: string, emailSubject: string, emailFrom: string, results: RuleExecutionResult[]): void {
    if (!this.getConfig().debugMode) return;

    const debugLog: RulesDebugLog = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      emailId,
      emailSubject,
      emailFrom,
      results,
      totalRulesChecked: results.length,
      totalRulesFired: results.filter(r => r.matched).length
    };

    try {
      const logs = this.getDebugLogs();
      logs.push(debugLog);
      
      // Keep only recent logs based on retention policy
      const retentionMs = this.getConfig().debugRetentionDays * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - retentionMs;
      const filteredLogs = logs.filter(log => log.timestamp >= cutoff);
      
      localStorage.setItem(this.DEBUG_LOG_KEY, JSON.stringify(filteredLogs));
    } catch (error) {
      console.error('Failed to save debug log:', error);
    }
  }

  /**
   * Get debug logs
   */
  getDebugLogs(): RulesDebugLog[] {
    try {
      const logsData = localStorage.getItem(this.DEBUG_LOG_KEY);
      return logsData ? JSON.parse(logsData) : [];
    } catch (error) {
      console.error('Failed to load debug logs:', error);
      return [];
    }
  }

  /**
   * Clear debug logs
   */
  clearDebugLogs(): void {
    localStorage.removeItem(this.DEBUG_LOG_KEY);
    console.log('Debug logs cleared');
  }

  /**
   * Export rules for backup
   */
  exportRules(): string {
    const data = {
      rules: this.getAllRules(),
      config: this.getConfig(),
      exportedAt: Date.now(),
      version: '1.0'
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import rules from backup
   */
  importRules(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.rules || !Array.isArray(data.rules)) {
        console.error('Invalid import data: missing or invalid rules array');
        return false;
      }

      // Validate rule structure
      for (const rule of data.rules) {
        if (!this.validateRuleStructure(rule)) {
          console.error('Invalid rule structure in import data:', rule);
          return false;
        }
      }

      // Import rules
      this.saveRules(data.rules);
      
      // Import config if available
      if (data.config) {
        this.setConfig(data.config);
      }

      console.log(`Successfully imported ${data.rules.length} rules`);
      return true;
    } catch (error) {
      console.error('Failed to import rules:', error);
      return false;
    }
  }

  /**
   * Clear all rules
   */
  clearAllRules(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('All rules cleared');
  }

  /**
   * Get rules statistics
   */
  getStatistics(): {
    totalRules: number;
    enabledRules: number;
    disabledRules: number;
    totalExecutions: number;
    rulesWithExecutions: number;
    debugLogsCount: number;
  } {
    const rules = this.getAllRules();
    const debugLogs = this.getDebugLogs();
    const totalExecutions = rules.reduce((sum, rule) => sum + rule.executionCount, 0);
    const rulesWithExecutions = rules.filter(rule => rule.executionCount > 0).length;

    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      disabledRules: rules.filter(r => !r.enabled).length,
      totalExecutions,
      rulesWithExecutions,
      debugLogsCount: debugLogs.length
    };
  }

  /**
   * Create example rules for demo/testing
   */
  createExampleRules(): void {
    const examples: Omit<Rule, 'id' | 'createdAt' | 'lastModified' | 'executionCount'>[] = [
      {
        name: 'Newsletter Link Detector',
        description: 'Detects newsletters with unsubscribe links and logs them',
        enabled: false,
        conditions: [
          {
            id: 'cond1',
            type: 'url_contains',
            operator: 'contains',
            value: 'unsubscribe',
            caseSensitive: false
          }
        ],
        actions: [
          {
            id: 'action1',
            type: 'log_message',
            parameters: {
              message: 'Newsletter detected from ${senderInfo.name || senderInfo.email}: ${email.subject}'
            },
            description: 'Log newsletter detection'
          },
          {
            id: 'action2',
            type: 'mark_email',
            parameters: {
              marker: 'newsletter'
            },
            description: 'Mark as newsletter'
          }
        ],
        logicOperator: 'AND'
      },
      {
        name: 'Auto-mark Newsletters as Read',
        description: 'Automatically mark newsletter emails as read',
        enabled: false,
        conditions: [
          {
            id: 'cond1',
            type: 'url_contains',
            operator: 'contains',
            value: 'unsubscribe',
            caseSensitive: false
          }
        ],
        actions: [
          {
            id: 'action1',
            type: 'log_message',
            parameters: {
              message: 'Auto-marking newsletter as read from ${senderInfo.name || senderInfo.email}: ${email.subject}'
            },
            description: 'Log mark as read action'
          },
          {
            id: 'action2',
            type: 'mark_as_read',
            parameters: {},
            description: 'Mark email as read'
          }
        ],
        logicOperator: 'AND'
      },
    ];

    examples.forEach(example => {
      this.createRule(example);
    });

    console.log(`Created ${examples.length} example rules`);
  }

  private saveRules(rules: Rule[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error('Failed to save rules:', error);
      throw error;
    }
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultConfig(): RulesConfig {
    return {
      debugMode: false,
      debugRetentionDays: 7
    };
  }

  private validateRuleStructure(rule: any): boolean {
    return (
      rule &&
      typeof rule.id === 'string' &&
      typeof rule.name === 'string' &&
      typeof rule.enabled === 'boolean' &&
      Array.isArray(rule.conditions) &&
      Array.isArray(rule.actions) &&
      typeof rule.logicOperator === 'string' &&
      (rule.logicOperator === 'AND' || rule.logicOperator === 'OR')
    );
  }
}

export const rulesService = new RulesService();
