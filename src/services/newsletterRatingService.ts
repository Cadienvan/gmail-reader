export type RatingValue = 'up' | 'down';
export type RejectionReason = 'not_newsletter' | 'low_value_full' | 'low_value_link' | 'manual_delete';

export interface NewsletterRating {
  // Unique per rated tab (the tab URL, or `email:<id>` when reading an email
  // with no tab open). This lets every tab be rated independently, even when
  // many tabs come from the same sender.
  key: string;
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
    manual_delete: number;
    total: number;
  };
}

export interface UnsubscribeSuggestion {
  sender: string;
  // Contenuti effettivamente fruiti negli ultimi 30 giorni (rating positivi).
  engagedLast30: number;
  // Segnali negativi negli ultimi 30 giorni: rating negativi + chiusure
  // automatiche di Gempest + cancellazioni manuali.
  discardedLast30: number;
  // Quante delle scartate sono cancellazioni manuali dell'utente.
  manualDeletesLast30: number;
  // Quante delle scartate sono chiusure automatiche di Gemini (low value / not newsletter).
  autoClosedLast30: number;
  // Frase pronta da mostrare in UI che spiega perché è suggerita la disiscrizione.
  reason: string;
}

const RATINGS_KEY = 'newsletter_ratings';
const REJECTIONS_KEY = 'newsletter_rejections';
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
// Soglia minima di segnali negli ultimi 30 giorni per suggerire la disiscrizione,
// così da evitare falsi positivi su un solo dato isolato.
const MIN_SIGNALS_FOR_SUGGESTION = 3;

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

  rateNewsletter(key: string, sender: string, rating: RatingValue): void {
    const ratings = this.getRatings();
    const existingIdx = ratings.findIndex(r => r.key === key);
    const entry: NewsletterRating = { key, sender, rating, timestamp: Date.now() };
    if (existingIdx >= 0) {
      ratings[existingIdx] = entry;
    } else {
      ratings.push(entry);
    }
    this.saveRatings(ratings);
  }

  removeRating(key: string): void {
    const ratings = this.getRatings().filter(r => r.key !== key);
    this.saveRatings(ratings);
  }

  getRatingForKey(key: string): RatingValue | null {
    const ratings = this.getRatings();
    return ratings.find(r => r.key === key)?.rating ?? null;
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
        manual_delete: allRejections.filter(r => r.reason === 'manual_delete').length,
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

  // Suggerisce i mittenti da cui valutare la disiscrizione: quelli per cui,
  // negli ultimi 30 giorni, i contenuti fruiti (rating positivi) sono inferiori
  // ai contenuti scartati (rating negativi + chiusure automatiche di Gempest +
  // cancellazioni manuali). Non esegue alcuna disiscrizione: produce solo l'elenco.
  getUnsubscribeSuggestions(): UnsubscribeSuggestion[] {
    const now = Date.now();
    const cutoff = now - MS_30_DAYS;

    const recentRatings = this.getRatings().filter(r => r.timestamp >= cutoff);
    const recentRejections = this.getRejections().filter(r => r.timestamp >= cutoff);

    const senders = new Set<string>([
      ...recentRatings.map(r => r.sender),
      ...recentRejections.map(r => r.sender),
    ]);

    const suggestions: UnsubscribeSuggestion[] = [];

    for (const sender of senders) {
      const ratings = recentRatings.filter(r => r.sender === sender);
      const rejections = recentRejections.filter(r => r.sender === sender);

      const engaged = ratings.filter(r => r.rating === 'up').length;
      const downvotes = ratings.filter(r => r.rating === 'down').length;
      const manualDeletes = rejections.filter(r => r.reason === 'manual_delete').length;
      const autoClosed = rejections.filter(r => r.reason !== 'manual_delete').length;
      const discarded = downvotes + manualDeletes + autoClosed;

      const totalSignals = engaged + discarded;
      if (totalSignals < MIN_SIGNALS_FOR_SUGGESTION) continue;
      if (engaged >= discarded) continue;

      let reason: string;
      if (engaged === 0) {
        reason = `${discarded} newsletter scartate e nessun contenuto fruito negli ultimi 30 giorni.`;
      } else {
        reason = `Solo ${engaged} contenuti fruiti contro ${discarded} scartati negli ultimi 30 giorni.`;
      }

      suggestions.push({
        sender,
        engagedLast30: engaged,
        discardedLast30: discarded,
        manualDeletesLast30: manualDeletes,
        autoClosedLast30: autoClosed,
        reason,
      });
    }

    // I casi più netti (più scartati, meno fruiti) prima.
    return suggestions.sort((a, b) =>
      (b.discardedLast30 - b.engagedLast30) - (a.discardedLast30 - a.engagedLast30));
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
