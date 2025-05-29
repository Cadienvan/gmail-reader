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

export interface PromptConfiguration {
  summaryPrompt: string;
  flashCardPrompt: string;
}
