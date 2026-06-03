export type RatingValue = 'up' | 'down';
export type RejectionReason = 'not_newsletter' | 'low_value_full' | 'low_value_link';

export interface NewsletterRating {
  emailId: string;
  sender: string;
  rating: RatingValue;
  timestamp: number;
}

export interface NewsletterRejection {
  sender: string;
  reason: RejectionReason;
  timestamp: number;
}

export interface SenderStats {
  sender: string;
  globalQuality: number;
  last30Quality: number;
  totalRatings: number;
  ratingsLast30: number;
  rejections: {
    not_newsletter: number;
    low_value_full: number;
    low_value_link: number;
    total: number;
  };
}

const RATINGS_KEY = 'newsletter_ratings';
const REJECTIONS_KEY = 'newsletter_rejections';
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

class NewsletterRatingService {
  private getRatings(): NewsletterRating[] {
    try {
      return JSON.parse(localStorage.getItem(RATINGS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveRatings(ratings: NewsletterRating[]): void {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  }

  private getRejections(): NewsletterRejection[] {
    try {
      return JSON.parse(localStorage.getItem(REJECTIONS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveRejections(rejections: NewsletterRejection[]): void {
    localStorage.setItem(REJECTIONS_KEY, JSON.stringify(rejections));
  }

  rateNewsletter(emailId: string, sender: string, rating: RatingValue): void {
    const ratings = this.getRatings();
    const existingIdx = ratings.findIndex(r => r.emailId === emailId);
    const entry: NewsletterRating = { emailId, sender, rating, timestamp: Date.now() };
    if (existingIdx >= 0) {
      ratings[existingIdx] = entry;
    } else {
      ratings.push(entry);
    }
    this.saveRatings(ratings);
  }

  removeRating(emailId: string): void {
    const ratings = this.getRatings().filter(r => r.emailId !== emailId);
    this.saveRatings(ratings);
  }

  getRatingForEmail(emailId: string): RatingValue | null {
    const ratings = this.getRatings();
    return ratings.find(r => r.emailId === emailId)?.rating ?? null;
  }

  recordRejection(sender: string, reason: RejectionReason): void {
    const rejections = this.getRejections();
    rejections.push({ sender, reason, timestamp: Date.now() });
    this.saveRejections(rejections);
  }

  getSenderStats(sender: string): SenderStats {
    const now = Date.now();
    const cutoff = now - MS_30_DAYS;

    const allRatings = this.getRatings().filter(r => r.sender === sender);
    const recentRatings = allRatings.filter(r => r.timestamp >= cutoff);

    const globalQuality = allRatings.length === 0
      ? -1
      : Math.round((allRatings.filter(r => r.rating === 'up').length / allRatings.length) * 100);

    const last30Quality = recentRatings.length === 0
      ? -1
      : Math.round((recentRatings.filter(r => r.rating === 'up').length / recentRatings.length) * 100);

    const allRejections = this.getRejections().filter(r => r.sender === sender);

    return {
      sender,
      globalQuality,
      last30Quality,
      totalRatings: allRatings.length,
      ratingsLast30: recentRatings.length,
      rejections: {
        not_newsletter: allRejections.filter(r => r.reason === 'not_newsletter').length,
        low_value_full: allRejections.filter(r => r.reason === 'low_value_full').length,
        low_value_link: allRejections.filter(r => r.reason === 'low_value_link').length,
        total: allRejections.length,
      },
    };
  }

  getAllSenderStats(): SenderStats[] {
    const ratings = this.getRatings();
    const rejections = this.getRejections();

    const senders = new Set<string>([
      ...ratings.map(r => r.sender),
      ...rejections.map(r => r.sender),
    ]);

    return Array.from(senders).map(s => this.getSenderStats(s));
  }

  exportData(): { ratings: NewsletterRating[]; rejections: NewsletterRejection[] } {
    return { ratings: this.getRatings(), rejections: this.getRejections() };
  }

  importData(data: { ratings?: NewsletterRating[]; rejections?: NewsletterRejection[] }): void {
    if (Array.isArray(data.ratings)) this.saveRatings(data.ratings);
    if (Array.isArray(data.rejections)) this.saveRejections(data.rejections);
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
