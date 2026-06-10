// Explicit user feedback on a newsletter: the judgement is always theirs, given at
// the moment of greatest clarity (reading / deleting). There is no longer any
// automatic vote: Gempest no longer contributes to this data.
export type FeedbackValue = 'positive' | 'negative';

export interface NewsletterFeedback {
  // Unique per rated tab (the tab URL, or `email:<id>` when rating an email with
  // no tab open). Lets every edition/tab be rated independently, even when they
  // come from the same sender.
  key: string;
  sender: string;
  feedback: FeedbackValue;
  timestamp: number;
}

export interface SenderStats {
  sender: string;
  // Cumulative (all-time) and last-30-days counts.
  positiveAll: number;
  negativeAll: number;
  positive30: number;
  negative30: number;
}

export interface UnsubscribeSuggestion {
  sender: string;
  positive30: number;
  negative30: number;
  // Ready-to-display sentence explaining why unsubscribing is suggested.
  reason: string;
}

const FEEDBACK_KEY = 'newsletter_feedback';
// Old model key (up/down ratings): migrated only once.
const LEGACY_RATINGS_KEY = 'newsletter_ratings';
const LEGACY_REJECTIONS_KEY = 'newsletter_rejections';
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
// Minimum number of signals in the last 30 days before suggesting unsubscribe,
// to avoid false positives on a single isolated data point.
const MIN_SIGNALS_FOR_SUGGESTION = 3;

class NewsletterRatingService {
  private getFeedbacks(): NewsletterFeedback[] {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      return [];
    }
    // No data in the new format: migrate once from the old up/down model.
    return this.migrateLegacy();
  }

  private saveFeedbacks(feedbacks: NewsletterFeedback[]): void {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbacks));
  }

  // Converts the old up/down ratings into positive/negative feedback (Gempest's
  // automatic rejections are dropped: the judgement goes back to the user only).
  // Always writes the new key so the migration happens only once.
  private migrateLegacy(): NewsletterFeedback[] {
    let migrated: NewsletterFeedback[] = [];
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_RATINGS_KEY) || '[]');
      if (Array.isArray(legacy)) {
        migrated = legacy
          .filter((r: any) => r && typeof r.key === 'string' && (r.rating === 'up' || r.rating === 'down'))
          .map((r: any) => ({
            key: r.key,
            sender: r.sender,
            feedback: (r.rating === 'up' ? 'positive' : 'negative') as FeedbackValue,
            timestamp: typeof r.timestamp === 'number' ? r.timestamp : Date.now(),
          }));
      }
    } catch {
      migrated = [];
    }
    this.saveFeedbacks(migrated);
    localStorage.removeItem(LEGACY_RATINGS_KEY);
    localStorage.removeItem(LEGACY_REJECTIONS_KEY);
    return migrated;
  }

  // Records (or updates) the user's feedback for a tab/email.
  setFeedback(key: string, sender: string, feedback: FeedbackValue): void {
    const feedbacks = this.getFeedbacks();
    const existingIdx = feedbacks.findIndex(f => f.key === key);
    const entry: NewsletterFeedback = { key, sender, feedback, timestamp: Date.now() };
    if (existingIdx >= 0) {
      feedbacks[existingIdx] = entry;
    } else {
      feedbacks.push(entry);
    }
    this.saveFeedbacks(feedbacks);
  }

  removeFeedback(key: string): void {
    this.saveFeedbacks(this.getFeedbacks().filter(f => f.key !== key));
  }

  getFeedbackForKey(key: string): FeedbackValue | null {
    return this.getFeedbacks().find(f => f.key === key)?.feedback ?? null;
  }

  getSenderStats(sender: string): SenderStats {
    const cutoff = Date.now() - MS_30_DAYS;
    const all = this.getFeedbacks().filter(f => f.sender === sender);
    const recent = all.filter(f => f.timestamp >= cutoff);

    return {
      sender,
      positiveAll: all.filter(f => f.feedback === 'positive').length,
      negativeAll: all.filter(f => f.feedback === 'negative').length,
      positive30: recent.filter(f => f.feedback === 'positive').length,
      negative30: recent.filter(f => f.feedback === 'negative').length,
    };
  }

  getAllSenderStats(): SenderStats[] {
    const senders = new Set<string>(this.getFeedbacks().map(f => f.sender));
    return Array.from(senders).map(s => this.getSenderStats(s));
  }

  // Suggests senders worth considering for unsubscribe: those for whom, over the
  // last 30 days, negative feedback outweighs positive (with at least
  // MIN_SIGNALS_FOR_SUGGESTION signals). It does not unsubscribe from anything.
  getUnsubscribeSuggestions(): UnsubscribeSuggestion[] {
    const cutoff = Date.now() - MS_30_DAYS;
    const recent = this.getFeedbacks().filter(f => f.timestamp >= cutoff);
    const senders = new Set<string>(recent.map(f => f.sender));

    const suggestions: UnsubscribeSuggestion[] = [];

    for (const sender of senders) {
      const items = recent.filter(f => f.sender === sender);
      const positive = items.filter(f => f.feedback === 'positive').length;
      const negative = items.filter(f => f.feedback === 'negative').length;

      const total = positive + negative;
      if (total < MIN_SIGNALS_FOR_SUGGESTION) continue;
      if (negative <= positive) continue;

      const reason = positive === 0
        ? `${negative} negative reports and none positive in the last 30 days.`
        : `${negative} negative reports against ${positive} positive in the last 30 days.`;

      suggestions.push({ sender, positive30: positive, negative30: negative, reason });
    }

    // The clearest cases (more negative, fewer positive) first.
    return suggestions.sort((a, b) =>
      (b.negative30 - b.positive30) - (a.negative30 - a.positive30));
  }

  // Clears all Newsletter Quality Insight data.
  clearAll(): void {
    localStorage.removeItem(FEEDBACK_KEY);
    localStorage.removeItem(LEGACY_RATINGS_KEY);
    localStorage.removeItem(LEGACY_REJECTIONS_KEY);
  }

  exportData(): { feedback: NewsletterFeedback[] } {
    return { feedback: this.getFeedbacks() };
  }

  importData(data: { feedback?: NewsletterFeedback[]; ratings?: any[] }): void {
    if (Array.isArray(data.feedback)) {
      this.saveFeedbacks(data.feedback);
      return;
    }
    // Backward compatibility with exports from the old model (up/down).
    if (Array.isArray(data.ratings)) {
      const migrated = data.ratings
        .filter((r: any) => r && typeof r.key === 'string' && (r.rating === 'up' || r.rating === 'down'))
        .map((r: any) => ({
          key: r.key,
          sender: r.sender,
          feedback: (r.rating === 'up' ? 'positive' : 'negative') as FeedbackValue,
          timestamp: typeof r.timestamp === 'number' ? r.timestamp : Date.now(),
        }));
      this.saveFeedbacks(migrated);
    }
  }
}

export const newsletterRatingService = new NewsletterRatingService();

export function extractSenderInfo(fromField: string): { email: string; name?: string } {
  const match = fromField.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/['"]/g, ''), email: match[2].trim() };
  }
  return { email: fromField.trim() };
}
