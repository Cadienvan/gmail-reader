import type { SenderScore, ScoringAction, ScoringConfig, SenderLeaderboard, SenderRank } from '../types';
import { environmentConfigService } from './environmentConfigService';

class EmailScoringService {
  private readonly STORAGE_KEY = 'email-scoring-data';
  private readonly ACTIONS_KEY = 'email-scoring-actions';

  /**
   * Add points for email summary action
   */
  async addEmailSummaryPoints(senderEmail: string, senderName: string | undefined, emailId: string): Promise<void> {
    if (!this.isEnabled()) return;

    const config = this.getScoringConfig();
    await this.recordAction({
      id: this.generateActionId(),
      senderEmail: this.normalizeSenderEmail(senderEmail),
      actionType: 'email_summary',
      points: config.emailSummaryPoints,
      timestamp: Date.now(),
      emailId
    }, senderName);
  }

  /**
   * Add points for link open action
   */
  async addLinkOpenPoints(senderEmail: string, senderName: string | undefined, linkUrl: string, emailId?: string): Promise<void> {
    if (!this.isEnabled()) return;

    const config = this.getScoringConfig();
    await this.recordAction({
      id: this.generateActionId(),
      senderEmail: this.normalizeSenderEmail(senderEmail),
      actionType: 'link_open',
      points: config.linkOpenPoints,
      timestamp: Date.now(),
      emailId,
      linkUrl
    }, senderName);
  }

  /**
   * Get sender leaderboards (all-time and last 90 days)
   */
  getSenderLeaderboard(): SenderLeaderboard {
    const scores = this.getSenderScores();
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    // All-time leaderboard
    const allTime = scores
      .sort((a, b) => b.totalScore - a.totalScore);

    // Last 90 days leaderboard - recalculate scores for this period
    const last90DaysScores = this.calculateScoresForPeriod(ninetyDaysAgo, now);
    const last90Days = last90DaysScores
      .sort((a, b) => b.totalScore - a.totalScore);

    return { allTime, last90Days };
  }

  /**
   * Get sender rank in both leaderboards
   */
  getSenderRank(senderEmail: string): SenderRank {
    const normalizedEmail = this.normalizeSenderEmail(senderEmail);
    const leaderboard = this.getSenderLeaderboard();

    const allTimeRank = leaderboard.allTime.findIndex(score => 
      this.normalizeSenderEmail(score.senderEmail) === normalizedEmail) + 1;

    const last90DaysRank = leaderboard.last90Days.findIndex(score => 
      this.normalizeSenderEmail(score.senderEmail) === normalizedEmail) + 1;

    return {
      allTimeRank: allTimeRank || 0,
      last90DaysRank: last90DaysRank || 0,
      totalSenders: Math.max(leaderboard.allTime.length, leaderboard.last90Days.length)
    };
  }

  /**
   * Get sender score details
   */
  getSenderScore(senderEmail: string): SenderScore | null {
    const normalizedEmail = this.normalizeSenderEmail(senderEmail);
    const scores = this.getSenderScores();
    return scores.find(score => 
      this.normalizeSenderEmail(score.senderEmail) === normalizedEmail) || null;
  }

  /**
   * Get all scoring actions for analytics
   */
  getAllActions(): ScoringAction[] {
    try {
      const actionsData = localStorage.getItem(this.ACTIONS_KEY);
      return actionsData ? JSON.parse(actionsData) : [];
    } catch (error) {
      console.error('Failed to load scoring actions:', error);
      return [];
    }
  }

  /**
   * Clear all scoring data
   */
  clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ACTIONS_KEY);
  }

  /**
   * Export scoring data for backup
   */
  exportData(): { scores: SenderScore[], actions: ScoringAction[] } {
    return {
      scores: this.getSenderScores(),
      actions: this.getAllActions()
    };
  }

  /**
   * Import scoring data from backup
   */
  importData(data: { scores: SenderScore[], actions: ScoringAction[] }): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.scores));
      localStorage.setItem(this.ACTIONS_KEY, JSON.stringify(data.actions));
      return true;
    } catch (error) {
      console.error('Failed to import scoring data:', error);
      return false;
    }
  }

  /**
   * Get statistics about scoring activity
   */
  getStatistics(): {
    totalActions: number;
    totalSenders: number;
    totalPoints: number;
    actionsLast30Days: number;
    topSender: SenderScore | null;
  } {
    const actions = this.getAllActions();
    const scores = this.getSenderScores();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const actionsLast30Days = actions.filter(action => action.timestamp >= thirtyDaysAgo).length;
    const totalPoints = scores.reduce((sum, score) => sum + score.totalScore, 0);
    const topSender = scores.length > 0 ? 
      scores.reduce((top, current) => current.totalScore > top.totalScore ? current : top) : null;

    return {
      totalActions: actions.length,
      totalSenders: scores.length,
      totalPoints,
      actionsLast30Days,
      topSender
    };
  }

  // Private methods
  private isEnabled(): boolean {
    return environmentConfigService.isScoringEnabled();
  }

  private getScoringConfig(): ScoringConfig {
    return environmentConfigService.getScoringConfig();
  }

  private async recordAction(action: ScoringAction, senderName?: string): Promise<void> {
    try {
      // Save action to actions log
      const actions = this.getAllActions();
      actions.push(action);
      localStorage.setItem(this.ACTIONS_KEY, JSON.stringify(actions));

      // Update sender scores
      await this.updateSenderScore(action, senderName);

      console.log(`Scored ${action.points} points for ${action.senderEmail} (${action.actionType})`);
    } catch (error) {
      console.error('Failed to record scoring action:', error);
    }
  }

  private async updateSenderScore(action: ScoringAction, senderName?: string): Promise<void> {
    const scores = this.getSenderScores();
    const existingScoreIndex = scores.findIndex(score => 
      this.normalizeSenderEmail(score.senderEmail) === action.senderEmail);

    if (existingScoreIndex >= 0) {
      // Update existing score
      const existingScore = scores[existingScoreIndex];
      scores[existingScoreIndex] = {
        ...existingScore,
        totalScore: existingScore.totalScore + action.points,
        emailSummaryCount: existingScore.emailSummaryCount + (action.actionType === 'email_summary' ? 1 : 0),
        linkOpenCount: existingScore.linkOpenCount + (action.actionType === 'link_open' ? 1 : 0),
        lastActivity: action.timestamp,
        // Update name if provided and not already set
        senderName: senderName || existingScore.senderName
      };
    } else {
      // Create new score
      scores.push({
        senderEmail: action.senderEmail,
        senderName,
        totalScore: action.points,
        emailSummaryCount: action.actionType === 'email_summary' ? 1 : 0,
        linkOpenCount: action.actionType === 'link_open' ? 1 : 0,
        lastActivity: action.timestamp,
        firstActivity: action.timestamp
      });
    }

    // Save updated scores
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores));
  }

  private getSenderScores(): SenderScore[] {
    try {
      const scoresData = localStorage.getItem(this.STORAGE_KEY);
      return scoresData ? JSON.parse(scoresData) : [];
    } catch (error) {
      console.error('Failed to load sender scores:', error);
      return [];
    }
  }

  private calculateScoresForPeriod(startTime: number, endTime: number): SenderScore[] {
    const actions = this.getAllActions().filter(action => 
      action.timestamp >= startTime && action.timestamp <= endTime);

    const scoresMap = new Map<string, SenderScore>();

    actions.forEach(action => {
      const normalizedEmail = action.senderEmail;
      const existing = scoresMap.get(normalizedEmail);

      if (existing) {
        scoresMap.set(normalizedEmail, {
          ...existing,
          totalScore: existing.totalScore + action.points,
          emailSummaryCount: existing.emailSummaryCount + (action.actionType === 'email_summary' ? 1 : 0),
          linkOpenCount: existing.linkOpenCount + (action.actionType === 'link_open' ? 1 : 0),
          lastActivity: Math.max(existing.lastActivity, action.timestamp),
          firstActivity: Math.min(existing.firstActivity, action.timestamp)
        });
      } else {
        // Try to get sender name from main scores
        const mainScore = this.getSenderScore(normalizedEmail);
        scoresMap.set(normalizedEmail, {
          senderEmail: normalizedEmail,
          senderName: mainScore?.senderName,
          totalScore: action.points,
          emailSummaryCount: action.actionType === 'email_summary' ? 1 : 0,
          linkOpenCount: action.actionType === 'link_open' ? 1 : 0,
          lastActivity: action.timestamp,
          firstActivity: action.timestamp
        });
      }
    });

    return Array.from(scoresMap.values());
  }

  private normalizeSenderEmail(email: string): string {
    // Extract email from "Name <email>" format if needed
    const match = email.match(/<(.+)>/);
    const cleanEmail = match ? match[1] : email;
    return cleanEmail.toLowerCase().trim();
  }

  private generateActionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract sender name and email from from field
   */
  extractSenderInfo(fromField: string): { email: string; name?: string } {
    const match = fromField.match(/^(.+?)\s*<(.+)>$/);
    if (match) {
      return {
        name: match[1].trim().replace(/['"]/g, ''),
        email: match[2].trim()
      };
    }
    return { email: fromField.trim() };
  }
}

export const emailScoringService = new EmailScoringService();