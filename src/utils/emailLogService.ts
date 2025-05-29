import type { ViewedEmail, ParsedEmail } from '../types';

class EmailLogService {
  private viewedEmails: ViewedEmail[] = [];
  private storageKey = 'gmail-traversal-viewed-emails';

  constructor() {
    this.loadFromStorage();
  }

  addViewedEmail(email: ParsedEmail): void {
    const viewedEmail: ViewedEmail = {
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      viewedAt: new Date()
    };

    // Remove if already exists to update the viewedAt timestamp
    this.viewedEmails = this.viewedEmails.filter(e => e.id !== email.id);
    
    // Add to the beginning of the array (most recent first)
    this.viewedEmails.unshift(viewedEmail);

    // Limit to last 100 viewed emails
    if (this.viewedEmails.length > 100) {
      this.viewedEmails = this.viewedEmails.slice(0, 100);
    }

    this.saveToStorage();
  }

  getViewedEmails(page = 1, pageSize = 10): { emails: ViewedEmail[], totalCount: number, totalPages: number } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEmails = this.viewedEmails.slice(startIndex, endIndex);
    const totalPages = Math.ceil(this.viewedEmails.length / pageSize);

    return {
      emails: [...paginatedEmails],
      totalCount: this.viewedEmails.length,
      totalPages
    };
  }
  
  getAllViewedEmails(): ViewedEmail[] {
    return [...this.viewedEmails];
  }

  removeViewedEmail(emailId: string): void {
    this.viewedEmails = this.viewedEmails.filter(e => e.id !== emailId);
    this.saveToStorage();
  }

  clearAllViewedEmails(): void {
    this.viewedEmails = [];
    this.saveToStorage();
  }

  hasBeenViewed(emailId: string): boolean {
    return this.viewedEmails.some(e => e.id === emailId);
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.viewedEmails));
    } catch (error) {
      console.error('Failed to save viewed emails to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert viewedAt strings back to Date objects
        this.viewedEmails = parsed.map((email: any) => ({
          ...email,
          viewedAt: new Date(email.viewedAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load viewed emails from storage:', error);
      this.viewedEmails = [];
    }
  }
}

export const emailLogService = new EmailLogService();
