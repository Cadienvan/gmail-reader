import type { Rule, RuleCondition, RuleAction, RuleContext, RuleExecutionResult } from '../types';
import { rulesService } from './rulesService';
import { emailScoringService } from './emailScoringService';
import { gmailService } from './gmailService';
import { environmentConfigService } from './environmentConfigService';
import { tabSummaryStorage } from './tabSummaryStorage';
import { ollamaService } from './ollamaService';

class RuleEngineService {
  private pendingExecutions = new Map<string, RuleContext>();

  /**
   * Execute all enabled rules against the email context
   */
  async executeRules(context: RuleContext): Promise<RuleExecutionResult[]> {
    const rules = rulesService.getEnabledRules();
    const results: RuleExecutionResult[] = [];

    // Check if any rules require content and if content is not loaded yet
    const hasContentRules = rules.some(rule => 
      rule.conditions.some(condition => 
        condition.type === 'content' || condition.type === 'content_regex'
      )
    );

    if (hasContentRules && context.email.body === '(Content will be loaded when opened)') {
      console.log('⏳ Deferring rule execution - content-based rules detected but content not loaded yet');
      // Store the context for later execution when content is loaded
      this.pendingExecutions.set(context.email.id, context);
      return [];
    }

    console.log(`Executing ${rules.length} enabled rules for email:`, context.email.subject);

    for (const rule of rules) {
      const result = await this.executeRule(rule, context);
      results.push(result);

      // Update execution count if rule matched
      if (result.matched) {
        rulesService.recordRuleExecution(rule.id, Date.now());
      }
    }

    // Log results for debug mode
    if (results.length > 0) {
      rulesService.logRuleExecution(
        context.email.id,
        context.email.subject,
        context.email.from,
        results
      );
    }

    return results;
  }

  /**
   * Execute pending rules when email content is loaded
   */
  async executeRulesForLoadedContent(emailId: string, loadedBody: string, htmlBody?: string): Promise<RuleExecutionResult[]> {
    const pendingContext = this.pendingExecutions.get(emailId);
    
    if (!pendingContext) {
      // No pending rules for this email
      return [];
    }

    // Update the context with the loaded content
    const updatedContext: RuleContext = {
      ...pendingContext,
      email: {
        ...pendingContext.email,
        body: loadedBody,
        htmlBody: htmlBody || pendingContext.email.htmlBody
      }
    };

    console.log('🔄 Executing deferred rules for email with loaded content:', pendingContext.email.subject);

    // Remove from pending executions
    this.pendingExecutions.delete(emailId);

    // Execute the rules with the updated context
    return this.executeRules(updatedContext);
  }

  /**
   * Clear pending executions for a specific email (cleanup)
   */
  clearPendingExecution(emailId: string): void {
    this.pendingExecutions.delete(emailId);
  }

  /**
   * Get count of pending rule executions
   */
  getPendingExecutionsCount(): number {
    return this.pendingExecutions.size;
  }

  /**
   * Execute a single rule against the email context
   */
  private async executeRule(rule: Rule, context: RuleContext): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    
    const result: RuleExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: false,
      conditionResults: [],
      actionResults: [],
      executionTime: 0,
      variables: { ...context.variables }
    };

    try {
      // Evaluate conditions
      let conditionsMatched = false;
      const conditionResults: Array<{
        conditionId: string;
        type: string;
        matched: boolean;
        actualValue?: any;
        expectedValue?: any;
        error?: string;
      }> = [];

      for (const condition of rule.conditions) {
        const conditionResult = await this.evaluateCondition(condition, context);
        conditionResults.push(conditionResult);
      }

      result.conditionResults = conditionResults;

      // Apply logic operator
      if (rule.logicOperator === 'AND') {
        conditionsMatched = conditionResults.every(cr => cr.matched);
      } else { // OR
        conditionsMatched = conditionResults.some(cr => cr.matched);
      }

      result.matched = conditionsMatched;

      // Execute actions if conditions matched
      if (conditionsMatched) {
        console.log(`Rule "${rule.name}" matched - executing ${rule.actions.length} actions`);
        
        for (const action of rule.actions) {
          const actionResult = await this.executeAction(action, context, result.variables);
          result.actionResults.push(actionResult);
          
          // Merge any variables created by the action
          if (actionResult.result && typeof actionResult.result === 'object' && actionResult.result.variables) {
            Object.assign(result.variables, actionResult.result.variables);
          }
        }
      }

    } catch (error) {
      console.error(`Error executing rule "${rule.name}":`, error);
      result.actionResults.push({
        actionId: 'error',
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Evaluate a single condition against the email context
   */
  private async evaluateCondition(
    condition: RuleCondition, 
    context: RuleContext
  ): Promise<{
    conditionId: string;
    type: string;
    matched: boolean;
    actualValue?: any;
    expectedValue?: any;
    error?: string;
  }> {
    try {
      const result = {
        conditionId: condition.id,
        type: condition.type,
        matched: false,
        actualValue: undefined as any,
        expectedValue: condition.value
      };

      let actualValue: any;

      // Get actual value based on condition type
      switch (condition.type) {
        case 'sender_email':
          actualValue = context.senderInfo.email;
          break;
        
        case 'sender_name':
          actualValue = context.senderInfo.name || '';
          break;
        
        case 'subject':
          actualValue = context.email.subject;
          break;
        
        case 'content':
          actualValue = context.email.htmlBody || '';
          // Skip content-based conditions if content is not loaded
          if (actualValue === '(Content will be loaded when opened)') {
            return {
              conditionId: condition.id,
              type: condition.type,
              matched: false,
              actualValue: '(Content not loaded yet)',
              expectedValue: condition.value,
              error: 'Content not loaded - condition skipped'
            };
          }
          break;
        
        case 'content_regex':
          actualValue = context.email.htmlBody || '';
          // Skip content-based conditions if content is not loaded
          if (actualValue === '(Content will be loaded when opened)') {
            return {
              conditionId: condition.id,
              type: condition.type,
              matched: false,
              actualValue: '(Content not loaded yet)',
              expectedValue: condition.value,
              error: 'Content not loaded - condition skipped'
            };
          }
          break;
        
        case 'url_contains':
          actualValue = context.extractedLinks.map(link => link.url).join(' ');
          break;
        
        case 'sender_score':
          // Get sender score from scoring service
          const score = emailScoringService.getSenderScore(context.senderInfo.email);
          actualValue = score ? score.totalScore : 0;
          break;
        
        case 'has_links':
          actualValue = context.extractedLinks.length > 0;
          break;
        
        case 'link_domain':
          actualValue = context.extractedLinks.map(link => link.domain).join(' ');
          break;
        
        default:
          throw new Error(`Unknown condition type: ${condition.type}`);
      }

      result.actualValue = actualValue;

      // Apply operator
      const matched = this.applyOperator(actualValue, condition.operator, condition.value, condition.caseSensitive);
      result.matched = matched;

      return result;
    } catch (error) {
      return {
        conditionId: condition.id,
        type: condition.type,
        matched: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Apply comparison operator
   */
  private applyOperator(actualValue: any, operator: string, expectedValue: any, caseSensitive = true): boolean {
    // Convert to strings for text operations if needed
    let actualStr = String(actualValue);
    let expectedStr = String(expectedValue);

    if (!caseSensitive && typeof actualValue === 'string' && typeof expectedValue === 'string') {
      actualStr = actualValue.toLowerCase();
      expectedStr = expectedValue.toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      
      case 'contains':
        return actualStr.includes(expectedStr);
      
      case 'starts_with':
        return actualStr.startsWith(expectedStr);
      
      case 'ends_with':
        return actualStr.endsWith(expectedStr);
      
      case 'regex_match':
        try {
          const flags = caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(expectedStr, flags);

          console.log('Testing', actualStr, expectedStr, flags);
          return regex.test(actualStr);
        } catch (error) {
          console.error('Invalid regex pattern:', expectedStr, error);
          return false;
        }
      
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      
      case 'exists':
        return actualValue !== null && actualValue !== undefined && actualValue !== '';
      
      case 'not_exists':
        return actualValue === null || actualValue === undefined || actualValue === '';
      
      default:
        console.error('Unknown operator:', operator);
        return false;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: RuleAction,
    context: RuleContext,
    variables: Record<string, any>
  ): Promise<{
    actionId: string;
    type: string;
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const result = {
        actionId: action.id,
        type: action.type,
        success: false,
        result: undefined as any
      };

      switch (action.type) {
        case 'javascript_code':
          result.result = await this.executeJavaScriptCode(action.parameters.code, context, variables);
          result.success = true;
          break;
        
        case 'open_url':
          const url = this.interpolateString(action.parameters.url, context, variables);
          window.open(url, action.parameters.target || '_blank');
          result.result = { openedUrl: url };
          result.success = true;
          break;
        
        case 'save_variable':
          const savedVariable = await this.saveVariable(action.parameters, context, variables);
          result.result = { variables: { [action.parameters.variableName]: savedVariable } };
          result.success = true;
          break;
        
        case 'log_message':
          const message = this.interpolateString(action.parameters.message, context, variables);
          console.log(`[Rule Action] ${message}`);
          result.result = { message };
          result.success = true;
          break;
        
        case 'add_score':
          await this.addScore(action.parameters, context);
          result.result = { pointsAdded: action.parameters.points };
          result.success = true;
          break;
        
        case 'mark_email':
          result.result = await this.markEmail(action.parameters, context);
          result.success = true;
          break;
        
        case 'notify':
          await this.showNotification(action.parameters, context, variables);
          result.result = { notificationShown: true };
          result.success = true;
          break;
        
        case 'delete_email':
          result.result = await this.deleteEmail(context);
          result.success = true;
          break;
        
        case 'mark_as_read':
          result.result = await this.markEmailAsRead(context);
          result.success = true;
          break;
        
        case 'request_summary':
          result.result = await this.requestEmailSummary(context);
          result.success = true;
          break;
        
        case 'goto_next_email':
          result.result = await this.gotoNextEmail();
          result.success = true;
          break;
        
        case 'goto_previous_email':
          result.result = await this.gotoPreviousEmail();
          result.success = true;
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return result;
    } catch (error) {
      return {
        actionId: action.id,
        type: action.type,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute JavaScript code safely
   */
  private async executeJavaScriptCode(code: string, context: RuleContext, variables: Record<string, any>): Promise<any> {
    try {
      // Create a sandboxed function with limited context
      const safeContext = {
        email: context.email,
        senderInfo: context.senderInfo,
        extractedLinks: context.extractedLinks,
        senderScore: context.senderScore,
        variables,
        console: {
          log: (...args: any[]) => console.log('[Rule JS]', ...args),
          error: (...args: any[]) => console.error('[Rule JS]', ...args),
          warn: (...args: any[]) => console.warn('[Rule JS]', ...args)
        },
        // Safe window operations
        window: {
          open: (url: string, target?: string) => window.open(url, target),
          location: window.location
        },
        // Utility functions
        utils: {
          extractRegex: (text: string, pattern: string, groupIndex = 0) => {
            try {
              const match = text.match(new RegExp(pattern, 'g'));
              if (match && match[groupIndex]) {
                return match[groupIndex];
              }
              const fullMatch = text.match(new RegExp(pattern));
              return fullMatch && fullMatch[groupIndex] ? fullMatch[groupIndex] : null;
            } catch (error) {
              console.error('Regex extraction error:', error);
              return null;
            }
          }
        }
      };

      // Create function with safe context
      const func = new Function('context', `
        const { email, senderInfo, extractedLinks, senderScore, variables, console, window, utils } = context;
        ${code}
      `);

      return func(safeContext);
    } catch (error) {
      console.error('JavaScript execution error:', error);
      throw error;
    }
  }

  /**
   * Save a variable from regex extraction or direct value
   */
  private async saveVariable(parameters: any, context: RuleContext, variables: Record<string, any>): Promise<any> {
    const { regexPattern, groupIndex = 1, source = 'content', directValue } = parameters;

    if (directValue !== undefined) {
      return this.interpolateString(directValue, context, variables);
    }

    if (regexPattern) {
      let sourceText = '';
      
      switch (source) {
        case 'content':
          sourceText = context.email.htmlBody || '';
          break;
        case 'subject':
          sourceText = context.email.subject;
          break;
        case 'from':
          sourceText = context.email.from;
          break;
        case 'urls':
          sourceText = context.extractedLinks.map(link => link.url).join(' ');
          break;
        default:
          sourceText = context.email.htmlBody || '';
      }

      try {
        const regex = new RegExp(regexPattern, 'g');
        const match = regex.exec(sourceText);
        if (match && match[groupIndex]) {
          return match[groupIndex];
        }
      } catch (error) {
        console.error('Regex variable extraction error:', error);
      }
    }

    return null;
  }

  /**
   * Add points to sender score
   */
  private async addScore(parameters: any, context: RuleContext): Promise<void> {
    const points = Number(parameters.points) || 0;
    
    if (points > 0) {
      // Create a scoring action to add points
      await emailScoringService.addEmailSummaryPoints(
        context.senderInfo.email,
        context.senderInfo.name,
        context.email.id
      );
    }
  }

  /**
   * Mark email with custom marker
   */
  private async markEmail(parameters: any, context: RuleContext): Promise<any> {
    const marker = parameters.marker || 'default';
    
    // Store email marker in localStorage for later reference
    const storageKey = `email-markers-${marker}`;
    try {
      const existingMarkers = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!existingMarkers.includes(context.email.id)) {
        existingMarkers.push(context.email.id);
        localStorage.setItem(storageKey, JSON.stringify(existingMarkers));
      }
      return { marker, emailId: context.email.id };
    } catch (error) {
      console.error('Error marking email:', error);
      throw error;
    }
  }

  /**
   * Show browser notification
   */
  private async showNotification(parameters: any, context: RuleContext, variables: Record<string, any>): Promise<void> {
    const title = this.interpolateString(parameters.title || 'Gmail Reader Rule', context, variables);
    const body = this.interpolateString(parameters.body || 'A rule was triggered', context, variables);
    
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
  }

  /**
   * Delete email
   */
  private async deleteEmail(context: RuleContext): Promise<any> {
    try {
      const success = await gmailService.deleteEmail(context.email.id);
      if (success) {
        console.log(`[Rule Action] Deleted email: ${context.email.subject}`);
        return { deleted: true, emailId: context.email.id };
      } else {
        throw new Error('Failed to delete email');
      }
    } catch (error) {
      console.error('Error deleting email via rule:', error);
      throw error;
    }
  }

  /**
   * Mark email as read
   */
  private async markEmailAsRead(context: RuleContext): Promise<any> {
    try {
      const success = await gmailService.markAsRead(context.email.id);
      if (success) {
        console.log(`[Rule Action] Marked email as read: ${context.email.subject}`);
        return { markedAsRead: true, emailId: context.email.id };
      } else {
        throw new Error('Failed to mark email as read');
      }
    } catch (error) {
      console.error('Error marking email as read via rule:', error);
      throw error;
    }
  }

  /**
   * Request email summary or save for later
   */
  private async requestEmailSummary(context: RuleContext): Promise<any> {
    try {
      const emailTabId = `email:${context.email.id}`;
      const saveForLaterMode = environmentConfigService.getSaveForLaterMode();
      
      if (saveForLaterMode) {
        // Save email for later without generating summary
        const savedContent = {
          url: emailTabId,
          summary: 'Email saved for later review',
          loading: false,
          savedForLater: true
        };
        
        await tabSummaryStorage.saveLinkSummary(
          emailTabId,
          savedContent,
          context.email.body,
          `Email: ${context.email.subject}`
        );
        
        console.log(`[Rule Action] Saved email for later: ${context.email.subject}`);
        
        // Add scoring points for email save
        try {
          await emailScoringService.addEmailSummaryPoints(
            context.senderInfo.email,
            context.senderInfo.name,
            context.email.id
          );
        } catch (scoringError) {
          console.error('Failed to add scoring points for email save:', scoringError);
        }
        
        return { savedForLater: true, emailId: context.email.id };
      } else {
        // Generate summary
        const summary = await ollamaService.generateSummary(context.email.body);
        
        const completedSummary = {
          url: emailTabId,
          summary,
          loading: false,
          modelUsed: 'short' as const,
          canUpgrade: ollamaService.canUpgradeSummary()
        };
        
        await tabSummaryStorage.saveLinkSummary(
          emailTabId,
          completedSummary,
          context.email.body,
          `Email: ${context.email.subject}`
        );
        
        console.log(`[Rule Action] Generated summary for email: ${context.email.subject}`);
        
        // Add scoring points for email summary
        try {
          await emailScoringService.addEmailSummaryPoints(
            context.senderInfo.email,
            context.senderInfo.name,
            context.email.id
          );
        } catch (scoringError) {
          console.error('Failed to add scoring points for email summary:', scoringError);
        }
        
        return { summarized: true, summary, emailId: context.email.id };
      }
    } catch (error) {
      console.error('Error requesting email summary via rule:', error);
      throw error;
    }
  }

  /**
   * Navigate to next email
   */
  private async gotoNextEmail(): Promise<any> {
    try {
      // Dispatch custom event for navigation
      const event = new CustomEvent('rule-navigation', {
        detail: { direction: 'next' }
      });
      window.dispatchEvent(event);
      
      console.log('[Rule Action] Navigating to next email');
      return { navigatedTo: 'next' };
    } catch (error) {
      console.error('Error navigating to next email via rule:', error);
      throw error;
    }
  }

  /**
   * Navigate to previous email
   */
  private async gotoPreviousEmail(): Promise<any> {
    try {
      // Dispatch custom event for navigation
      const event = new CustomEvent('rule-navigation', {
        detail: { direction: 'previous' }
      });
      window.dispatchEvent(event);
      
      console.log('[Rule Action] Navigating to previous email');
      return { navigatedTo: 'previous' };
    } catch (error) {
      console.error('Error navigating to previous email via rule:', error);
      throw error;
    }
  }

  /**
   * Interpolate string with context variables
   */
  private interpolateString(template: string, context: RuleContext, variables: Record<string, any>): string {
    let result = template;
    
    // Replace context variables
    result = result.replace(/\$\{email\.(\w+)\}/g, (match, prop) => {
      return (context.email as any)[prop] || match;
    });
    
    result = result.replace(/\$\{senderInfo\.(\w+)\}/g, (match, prop) => {
      return (context.senderInfo as any)[prop] || match;
    });
    
    result = result.replace(/\$\{senderScore\}/g, String(context.senderScore || 0));
    
    // Replace custom variables
    result = result.replace(/\$\{variables\.(\w+)\}/g, (match, prop) => {
      return variables[prop] || match;
    });
    
    return result;
  }

  /**
   * Get available condition types with their metadata
   */
  getConditionTypes(): Array<{
    type: string;
    label: string;
    description: string;
    valueType: 'string' | 'number' | 'boolean';
    supportedOperators: string[];
  }> {
    return [
      {
        type: 'sender_email',
        label: 'Sender Email',
        description: 'The email address of the sender',
        valueType: 'string',
        supportedOperators: ['equals', 'contains', 'starts_with', 'ends_with', 'regex_match']
      },
      {
        type: 'sender_name',
        label: 'Sender Name',
        description: 'The display name of the sender',
        valueType: 'string',
        supportedOperators: ['equals', 'contains', 'starts_with', 'ends_with', 'regex_match', 'exists', 'not_exists']
      },
      {
        type: 'subject',
        label: 'Subject',
        description: 'The email subject line',
        valueType: 'string',
        supportedOperators: ['equals', 'contains', 'starts_with', 'ends_with', 'regex_match']
      },
      {
        type: 'content',
        label: 'Email Content',
        description: 'The body text of the email',
        valueType: 'string',
        supportedOperators: ['contains', 'regex_match', 'exists', 'not_exists']
      },
      {
        type: 'content_regex',
        label: 'Content (Regex)',
        description: 'Match email content using regular expressions',
        valueType: 'string',
        supportedOperators: ['regex_match']
      },
      {
        type: 'url_contains',
        label: 'URLs Contain',
        description: 'Check if any extracted URLs contain text',
        valueType: 'string',
        supportedOperators: ['contains', 'regex_match']
      },
      {
        type: 'link_domain',
        label: 'Link Domain',
        description: 'Check domains of extracted links',
        valueType: 'string',
        supportedOperators: ['equals', 'contains', 'starts_with', 'ends_with']
      },
      {
        type: 'sender_score',
        label: 'Sender Score',
        description: 'The scoring points of the sender',
        valueType: 'number',
        supportedOperators: ['equals', 'greater_than', 'less_than']
      },
      {
        type: 'has_links',
        label: 'Has Links',
        description: 'Whether the email contains any links',
        valueType: 'boolean',
        supportedOperators: ['equals']
      }
    ];
  }

  /**
   * Get available action types with their metadata
   */
  getActionTypes(): Array<{
    type: string;
    label: string;
    description: string;
    parameters: Array<{
      name: string;
      label: string;
      type: 'string' | 'number' | 'boolean' | 'textarea';
      required: boolean;
      description: string;
      placeholder?: string;
    }>;
  }> {
    return [
      {
        type: 'javascript_code',
        label: 'Execute JavaScript',
        description: 'Run custom JavaScript code with access to email context',
        parameters: [
          {
            name: 'code',
            label: 'JavaScript Code',
            type: 'textarea',
            required: true,
            description: 'JavaScript code to execute. Available: email, senderInfo, extractedLinks, senderScore, variables, console, window, utils',
            placeholder: 'console.log("Email from:", senderInfo.email);\nif (extractedLinks.length > 0) {\n  window.open(extractedLinks[0].url);\n}'
          }
        ]
      },
      {
        type: 'open_url',
        label: 'Open URL',
        description: 'Open a URL in a new window or tab',
        parameters: [
          {
            name: 'url',
            label: 'URL',
            type: 'string',
            required: true,
            description: 'URL to open. Can use variables: ${email.subject}, ${senderInfo.email}, ${variables.variableName}',
            placeholder: 'https://example.com?from=${senderInfo.email}'
          },
          {
            name: 'target',
            label: 'Target',
            type: 'string',
            required: false,
            description: 'Window target (_blank, _self, etc.)',
            placeholder: '_blank'
          }
        ]
      },
      {
        type: 'save_variable',
        label: 'Save Variable',
        description: 'Extract and save data to a variable for use in other actions',
        parameters: [
          {
            name: 'variableName',
            label: 'Variable Name',
            type: 'string',
            required: true,
            description: 'Name of the variable to save',
            placeholder: 'extractedUrl'
          },
          {
            name: 'regexPattern',
            label: 'Regex Pattern',
            type: 'string',
            required: false,
            description: 'Regex pattern to extract value (leave empty for direct value)',
            placeholder: 'href=["\']([^"\']*google\\.com[^"\']*)["\']'
          },
          {
            name: 'groupIndex',
            label: 'Regex Group Index',
            type: 'number',
            required: false,
            description: 'Which regex capture group to use (default: 1)',
            placeholder: '1'
          },
          {
            name: 'source',
            label: 'Source',
            type: 'string',
            required: false,
            description: 'Source to extract from: content, subject, from, urls',
            placeholder: 'content'
          },
          {
            name: 'directValue',
            label: 'Direct Value',
            type: 'string',
            required: false,
            description: 'Direct value to save (instead of regex extraction)',
            placeholder: 'Some fixed value'
          }
        ]
      },
      {
        type: 'log_message',
        label: 'Log Message',
        description: 'Write a message to the browser console',
        parameters: [
          {
            name: 'message',
            label: 'Message',
            type: 'string',
            required: true,
            description: 'Message to log. Can use variables: ${email.subject}, ${senderInfo.email}, ${variables.variableName}',
            placeholder: 'Rule triggered for ${senderInfo.name}: ${email.subject}'
          }
        ]
      },
      {
        type: 'add_score',
        label: 'Add Score Points',
        description: 'Add points to the sender\'s quality score',
        parameters: [
          {
            name: 'points',
            label: 'Points',
            type: 'number',
            required: true,
            description: 'Number of points to add',
            placeholder: '10'
          },
          {
            name: 'reason',
            label: 'Reason',
            type: 'string',
            required: false,
            description: 'Reason for adding points',
            placeholder: 'Rule-based bonus'
          }
        ]
      },
      {
        type: 'mark_email',
        label: 'Mark Email',
        description: 'Mark the email with a custom tag for later reference',
        parameters: [
          {
            name: 'marker',
            label: 'Marker Tag',
            type: 'string',
            required: true,
            description: 'Tag to mark the email with',
            placeholder: 'newsletter'
          }
        ]
      },
      {
        type: 'notify',
        label: 'Browser Notification',
        description: 'Show a browser notification',
        parameters: [
          {
            name: 'title',
            label: 'Title',
            type: 'string',
            required: true,
            description: 'Notification title',
            placeholder: 'Gmail Reader Rule'
          },
          {
            name: 'body',
            label: 'Message',
            type: 'string',
            required: true,
            description: 'Notification message. Can use variables: ${email.subject}, ${senderInfo.email}',
            placeholder: 'New email from ${senderInfo.name}'
          }
        ]
      },
      {
        type: 'delete_email',
        label: 'Delete Email',
        description: 'Delete the email (move to trash)',
        parameters: []
      },
      {
        type: 'mark_as_read',
        label: 'Mark as Read',
        description: 'Mark the email as read',
        parameters: []
      },
      {
        type: 'request_summary',
        label: 'Request Summary',
        description: 'Generate an email summary or save for later (based on mode setting)',
        parameters: []
      },
      {
        type: 'goto_next_email',
        label: 'Go to Next Email',
        description: 'Navigate to the next email in the list',
        parameters: []
      },
      {
        type: 'goto_previous_email',
        label: 'Go to Previous Email',
        description: 'Navigate to the previous email in the list',
        parameters: []
      }
    ];
  }
}

export const ruleEngineService = new RuleEngineService();
