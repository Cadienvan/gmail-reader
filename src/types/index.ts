export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      data?: string;
      size: number;
    };
    parts?: Array<{
      mimeType: string;
      body: {
        data?: string;
        size: number;
      };
    }>;
  };
  internalDate: string;
}

export interface ParsedEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  htmlBody?: string;
  snippet?: string;
  isRead: boolean;
}

export interface ExtractedLink {
  url: string;
  text: string;
  domain: string;
}

export interface ViewedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  viewedAt: Date;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface LinkSummary {
  url: string;
  finalUrl?: string;
  summary: string;
  error?: string;
  loading: boolean;
  modelUsed?: 'short' | 'long';
  canUpgrade?: boolean; // true if this was generated with quick model and can be upgraded
}

export interface EmailSummary {
  summary: string;
  error?: string;
  loading: boolean;
  modelUsed?: 'short' | 'long';
  canUpgrade?: boolean;
}

export interface FlashCardTag {
  id?: number;
  name: string;
  color?: string;
}

export interface FlashCard {
  id?: number;
  question: string;
  answer: string;
  sourceUrl?: string;
  sourceType: 'link' | 'email';
  sourceId: string;
  createdAt?: string;
  tags?: FlashCardTag[];
}

export interface FlashCardSet {
  cards: FlashCard[];
  sourceUrl?: string;
  sourceType: 'link' | 'email';
  sourceId: string;
  loading: boolean;
  error?: string;
}

export interface ModelConfiguration {
  quick: string;
  detailed: string;
}

export interface PerformanceConfiguration {
  enableQueueMode: boolean;
  maxConcurrentRequests: number;
  requestDelay: number; // milliseconds between requests when queue is processing
}

export interface QueuedRequest {
  id: string;
  type: 'summary' | 'flashcard' | 'improved-summary' | 'quality';
  content: string;
  resolve: (result: string | any) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  addedAt: number;
}

export interface PromptConfiguration {
  summaryPrompt: string;
  flashCardPrompt: string;
  qualityAssessmentPrompt: string;
}

export interface DeepAnalysisProgress {
  totalEmails: number;
  processedEmails: number;
  currentPage: number;
  qualityResults: QualityAssessmentResult[];
  isRunning: boolean;
  currentlyProcessingEmailId?: string;
  currentlyProcessingEmailSubject?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface QualityAssessmentResult {
  emailId: string;
  subject: string;
  from: string;
  hasLinks: boolean;
  contentType: 'full-email' | 'links-only' | 'mixed';
  qualityScore: number;
  diversityScore: number;
  reasoning: string;
  isHighQuality: boolean;
  processedAt: number;
}

export interface DeepAnalysisConfig {
  enabled: boolean;
  qualityThreshold: number;
  diversityThreshold: number;
  maxPagesToProcess: number;
  autoCreateTabs: boolean;
}

// New types for sender selection feature
export interface EmailSender {
  email: string;
  name?: string;
  emailCount: number;
  lastEmailDate: number;
  sampleSubjects: string[];
}

export interface SenderSelectionConfig {
  email: string;
  name?: string;
  include: boolean;
  contentType: 'full-text' | 'links-only' | 'mixed';
  emailCount: number;
  lastEmailDate: number;
  sampleSubjects: string[];
}

export interface SenderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (senderConfig: SenderSelectionConfig[]) => void;
  senders: EmailSender[];
  isLoading?: boolean;
  title?: string;
}

// URL Filter types
export interface UrlFilterPattern {
  id: string;
  name: string;
  pattern: string;
  description: string;
  enabled: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface UrlFilterConfigPanelProps {
  onConfigChange?: (patterns: UrlFilterPattern[]) => void;
  className?: string;
}

// Email Scoring System types
export interface SenderScore {
  senderEmail: string;
  senderName?: string;
  totalScore: number;
  emailSummaryCount: number;
  linkOpenCount: number;
  lastActivity: number;
  firstActivity: number;
}

export interface ScoringAction {
  id: string;
  senderEmail: string;
  actionType: 'email_summary' | 'link_open';
  points: number;
  timestamp: number;
  emailId?: string;
  linkUrl?: string;
}

export interface ScoringConfig {
  enabled: boolean;
  emailSummaryPoints: number;
  linkOpenPoints: number;
}

export interface SenderLeaderboard {
  allTime: SenderScore[];
  last90Days: SenderScore[];
}

export interface SenderRank {
  allTimeRank: number;
  last90DaysRank: number;
  totalSenders: number;
}

// Rules System types
export interface RuleCondition {
  id: string;
  type: 'sender_email' | 'sender_name' | 'subject' | 'content' | 'content_regex' | 'url_contains' | 'sender_score' | 'has_links' | 'link_domain';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex_match' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: string | number | boolean;
  caseSensitive?: boolean;
}

export interface RuleAction {
  id: string;
  type: 'javascript_code' | 'open_url' | 'save_variable' | 'log_message' | 'add_score' | 'mark_email' | 'notify' | 'delete_email' | 'mark_as_read' | 'request_summary' | 'goto_next_email' | 'goto_previous_email';
  parameters: Record<string, any>;
  description?: string;
}

export interface RuleContext {
  email: ParsedEmail;
  senderInfo: {
    email: string;
    name?: string;
  };
  extractedLinks: ExtractedLink[];
  senderScore?: number;
  variables: Record<string, any>; // Variables saved from previous conditions
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  logicOperator: 'AND' | 'OR'; // How to combine multiple conditions
  createdAt: number;
  lastModified: number;
  executionCount: number;
  lastExecuted?: number;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  conditionResults: Array<{
    conditionId: string;
    type: string;
    matched: boolean;
    actualValue?: any;
    expectedValue?: any;
    error?: string;
  }>;
  actionResults: Array<{
    actionId: string;
    type: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  executionTime: number;
  variables: Record<string, any>;
}

export interface RulesDebugLog {
  id: string;
  timestamp: number;
  emailId: string;
  emailSubject: string;
  emailFrom: string;
  results: RuleExecutionResult[];
  totalRulesChecked: number;
  totalRulesFired: number;
}

export interface RulesConfig {
  debugMode: boolean;
  debugRetentionDays: number; // How long to keep debug logs
}
