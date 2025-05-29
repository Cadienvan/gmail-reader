import type { ParsedEmail, EmailMessage } from '../types';
import { ollamaService } from './ollamaService';
import { emailCacheService } from './emailCacheService';
import { environmentConfigService } from './environmentConfigService';

interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

class GmailService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isAuthenticatedFlag = false;
  private credentials: GmailCredentials | null = null;
  private tokenExpiryTime: number | null = null;
  private maxRetries: number = 3;

  constructor() {
    // Load credentials from environment configuration service
    this.loadCredentials();
    // Load stored tokens
    this.loadStoredTokens();
  }

  private loadCredentials() {
    const envConfig = environmentConfigService.getConfiguration();
    this.credentials = {
      client_id: envConfig.googleClientId,
      client_secret: envConfig.googleClientSecret,
      redirect_uri: envConfig.googleRedirectUri
    };

    // Fallback to environment variables if config is empty
    if (!this.credentials.client_id) {
      this.credentials = {
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
        redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth-callback.html`
      };
    }
  }

  private loadStoredTokens() {
    try {
      const accessToken = localStorage.getItem('gmail_access_token');
      const refreshToken = localStorage.getItem('gmail_refresh_token');
      const expiryTime = localStorage.getItem('gmail_token_expiry');
      
      if (accessToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiryTime = expiryTime ? parseInt(expiryTime) : null;
        
        // Check if token is still valid
        if (this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
          this.isAuthenticatedFlag = true;
        } else {
          this.clearTokens();
        }
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
    }
  }

  private saveTokens(accessToken: string, refreshToken?: string, expiresIn?: number) {
    try {
      localStorage.setItem('gmail_access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('gmail_refresh_token', refreshToken);
      }
      if (expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('gmail_token_expiry', expiryTime.toString());
        this.tokenExpiryTime = expiryTime;
      }
      
      this.accessToken = accessToken;
      if (refreshToken) {
        this.refreshToken = refreshToken;
      }
      this.isAuthenticatedFlag = true;

      // Clean up temporary credentials stored for the callback
      localStorage.removeItem('gmail_client_id');
      localStorage.removeItem('gmail_client_secret');
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  private clearTokens() {
    localStorage.removeItem('gmail_access_token');
    localStorage.removeItem('gmail_refresh_token');
    localStorage.removeItem('gmail_token_expiry');
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiryTime = null;
    this.isAuthenticatedFlag = false;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken || !this.credentials) {
      return false;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data: GoogleTokenResponse = await response.json();
      this.saveTokens(data.access_token, undefined, data.expires_in);
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.clearTokens();
      return false;
    }
  }

  async authenticateWithGoogle(): Promise<boolean> {
    try {
      if (!this.credentials?.client_id || !this.credentials?.client_secret) {
        throw new Error('Google OAuth credentials not configured. Please check your environment variables.');
      }

      // Check if we already have valid tokens
      if (this.isAuthenticatedFlag && this.accessToken) {
        return true;
      }

      // Try to refresh if we have a refresh token
      if (this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return true;
        }
      }

      // Store credentials in localStorage for the callback page to use
      localStorage.setItem('gmail_client_id', this.credentials.client_id);
      localStorage.setItem('gmail_client_secret', this.credentials.client_secret);

      // Generate authorization URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', this.credentials.client_id);
      authUrl.searchParams.set('redirect_uri', this.credentials.redirect_uri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Open the authorization URL in a new window
      const authWindow = window.open(authUrl.toString(), 'auth', 'width=500,height=600');
      
      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            
            // Clean up temporary credentials on window close
            localStorage.removeItem('gmail_client_id');
            localStorage.removeItem('gmail_client_secret');
            
            reject(new Error('Authorization window was closed'));
          }
        }, 1000);

        // Listen for the authorization code from the redirect
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            authWindow?.close();
            
            this.saveTokens(event.data.access_token, event.data.refresh_token);
            resolve(true);
          } else if (event.data.type === 'GMAIL_AUTH_ERROR') {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            authWindow?.close();
            
            // Clean up temporary credentials on error
            localStorage.removeItem('gmail_client_id');
            localStorage.removeItem('gmail_client_secret');
            
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', messageListener);
      });
    } catch (error) {
      console.error('Gmail authentication failed:', error);
      throw error;
    }
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    // Check if token needs refresh
    if (this.tokenExpiryTime && Date.now() >= this.tokenExpiryTime - 60000) { // Refresh 1 minute before expiry
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh access token');
      }
    }

    return this.makeRequestWithRetry(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  private async makeRequestWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
    try {
      const response = await fetch(url, options);

      // If it's an auth error (401), try to refresh the token once
      if (response.status === 401 && retryCount === 0) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Update Authorization header with new token
          const newOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${this.accessToken}`
            }
          };
          // Retry with the new token
          return this.makeRequestWithRetry(url, newOptions, retryCount + 1);
        } else {
          throw new Error('Authentication failed. Please re-authenticate.');
        }
      }
      
      // For network errors or server errors (5xx), retry up to maxRetries
      if (!response.ok && retryCount < this.maxRetries) {
        // Exponential backoff delay: 1s, 2s, 4s, ...
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(url, options, retryCount + 1);
      }
      
      return response;
    } catch (error) {
      // Network errors (offline, DNS issues, etc.)
      if (retryCount < this.maxRetries) {
        // Exponential backoff delay: 1s, 2s, 4s, ...
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  async getUnreadEmails(pageToken?: string, maxResults: number = 50, forceRefresh: boolean = false): Promise<{ emails: ParsedEmail[], nextPageToken?: string }> {
    if (!this.isAuthenticatedFlag) {
      throw new Error('Gmail not authenticated. Please authenticate first.');
    }

    // Try to get cached emails first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedResult = emailCacheService.getCachedEmails(pageToken);
      if (cachedResult) {
        console.log('Using cached emails for page:', pageToken || 'first');
        return cachedResult;
      }
    }

    try {
      // Build URL with pagination parameters - exclude spam, starred emails, and only show inbox messages
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread -is:spam -is:starred in:inbox&maxResults=${maxResults}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      console.log('Fetching emails from Gmail API for page:', pageToken || 'first');

      // First get the list of unread message IDs
      const listResponse = await this.makeAuthenticatedRequest(url);

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch message list: ${listResponse.statusText}`);
      }

      const listData = await listResponse.json();

      if (!listData.messages || listData.messages.length === 0) {
        const result = { emails: [], nextPageToken: undefined };
        emailCacheService.cacheEmails([], pageToken, undefined);
        return result;
      }

      // Get basic metadata for each message (no body content to avoid rate limiting)
      const emailPromises = listData.messages.map(async (message: any) => {
        const emailResponse = await this.makeAuthenticatedRequest(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
        );
        
        if (!emailResponse.ok) {
          throw new Error(`Failed to fetch email ${message.id}: ${emailResponse.statusText}`);
        }
        
        return emailResponse.json();
      });

      const emailMessages: EmailMessage[] = await Promise.all(emailPromises);
      
      // Parse the email messages (without body content)
      const parsedEmails = emailMessages.map(this.parseEmailMessage);
      
      // Cache the results
      emailCacheService.cacheEmails(parsedEmails, pageToken, listData.nextPageToken);
      
      return { 
        emails: parsedEmails,
        nextPageToken: listData.nextPageToken
      };
    } catch (error) {
      console.error('Failed to fetch unread emails:', error);
      throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEmailContent(emailId: string): Promise<{ body: string; htmlBody?: string }> {
    if (!this.isAuthenticatedFlag) {
      throw new Error('Gmail not authenticated. Please authenticate first.');
    }

    // Check cache first - only use cached content if it's real content (not placeholder)
    const cachedEmailWithRealContent = emailCacheService.getCachedEmailContentWithRealBody(emailId);
    if (cachedEmailWithRealContent) {
      console.log('Using cached email content for:', emailId);
      return { 
        body: cachedEmailWithRealContent.body, 
        htmlBody: cachedEmailWithRealContent.htmlBody 
      };
    }

    // Check if we have cached email metadata but need to fetch content
    const cachedEmailMetadata = emailCacheService.getCachedEmailContent(emailId);
    if (cachedEmailMetadata && cachedEmailMetadata.body === '(Content will be loaded when opened)') {
      console.log('Email metadata cached but fetching content for:', emailId);
    }

    try {
      console.log('Fetching email content from Gmail API for:', emailId);
      
      // Fetch the full email content
      const emailResponse = await this.makeAuthenticatedRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`
      );

      if (!emailResponse.ok) {
        throw new Error(`Failed to fetch email content: ${emailResponse.statusText}`);
      }

      const emailData = await emailResponse.json();

      // Extract both text and HTML content
      let body = '';
      let htmlBody = '';

      const extractContent = (part: any): void => {
        if (part.mimeType === 'text/plain' && part.body?.data && !body) {
          body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (part.mimeType === 'text/html' && part.body?.data && !htmlBody) {
          htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (part.parts) {
          part.parts.forEach(extractContent);
        }
      };

      if (emailData.payload.body?.data) {
        // If the email has direct body data, decode it
        const content = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        // Determine if it's HTML or text based on content
        if (content.includes('<html>') || content.includes('<body>') || content.includes('<div>')) {
          htmlBody = content;
        } else {
          body = content;
        }
      } else if (emailData.payload.parts) {
        // Extract both text and HTML parts
        emailData.payload.parts.forEach(extractContent);
      }

      // Cache the email content
      const cachedEmail = emailCacheService.getCachedEmailContent(emailId);
      if (cachedEmail) {
        const updatedEmail: ParsedEmail = {
          ...cachedEmail,
          body: body || '(No text content available)',
          htmlBody: htmlBody || undefined
        };
        emailCacheService.cacheEmailContent(updatedEmail);
      }

      return {
        body: body || '(No text content available)',
        htmlBody: htmlBody || undefined
      };
    } catch (error) {
      console.error('Failed to fetch email content:', error);
      throw new Error(`Failed to fetch email content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseEmailMessage(message: EmailMessage): ParsedEmail {
    const headers = message.payload.headers;
    
    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = getHeader('To');
    const date = getHeader('Date');

    // For metadata format, we don't have body content yet
    // It will be loaded separately when needed

    return {
      id: message.id,
      subject: subject || '(No Subject)',
      from: from || 'Unknown Sender',
      to: to || 'Unknown Recipient',
      date: date || new Date().toISOString(),
      body: '(Content will be loaded when opened)',
      htmlBody: undefined,
      snippet: message.snippet,
      isRead: false
    };
  }

  async markAsRead(emailId: string): Promise<boolean> {
    if (!this.isAuthenticatedFlag) {
      throw new Error('Gmail not authenticated');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
        {
          method: 'POST',
          body: JSON.stringify({
            removeLabelIds: ['UNREAD']
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to mark email as read:', error);
      return false;
    }
  }

  async deleteEmail(emailId: string): Promise<boolean> {
    if (!this.isAuthenticatedFlag) {
      throw new Error('Gmail not authenticated');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`,
        {
          method: 'POST'
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to delete email:', error);
      return false;
    }
  }

  async summarizeEmailContent(emailId: string): Promise<string> {
    if (!this.isAuthenticatedFlag) {
      throw new Error('Gmail not authenticated');
    }

    try {
      // Fetch the email content
      const emailResponse = await this.makeAuthenticatedRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`
      );

      if (!emailResponse.ok) {
        throw new Error(`Failed to fetch email content: ${emailResponse.statusText}`);
      }

      const emailData = await emailResponse.json();

      // Extract only the text/plain email body
      let emailBody = '';
      
      const extractTextBody = (part: any): void => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          emailBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (part.parts && !emailBody) { // Only recurse if we haven't found text yet
          part.parts.forEach(extractTextBody);
        }
      };

      if (emailData.payload.body?.data) {
        emailBody = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } else if (emailData.payload.parts) {
        emailData.payload.parts.forEach(extractTextBody);
      }

      // Use Ollama service to summarize the content
      const summary = await ollamaService.generateSummary(emailBody);

      return summary;
    } catch (error) {
      console.error('Failed to summarize email content:', error);
      throw new Error(`Failed to summarize email content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isConfigured(): boolean {
    return !!(this.credentials?.client_id && this.credentials?.client_secret);
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedFlag;
  }

  logout(): void {
    this.clearTokens();
    // Clear cache when logging out
    emailCacheService.forceRefresh();
  }

  // Cache management methods
  getCacheStats() {
    return emailCacheService.getCacheStats();
  }

  getDetailedCacheStats() {
    return emailCacheService.getDetailedCacheStats();
  }

  clearCache(): void {
    emailCacheService.forceRefresh();
  }

  refreshCredentials(): void {
    this.loadCredentials();
  }
}

export const gmailService = new GmailService();
