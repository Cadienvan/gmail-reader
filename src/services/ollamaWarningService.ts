/**
 * Service to manage Ollama warning dismissal state
 * Allows users to dismiss the Ollama warning when in "Save for later" mode
 * and remembers this choice for 30 days
 */

class OllamaWarningService {
  private readonly DISMISSAL_KEY = 'ollama-warning-dismissed';
  private readonly DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  /**
   * Check if the Ollama warning has been dismissed and is still valid
   */
  isWarningDismissed(): boolean {
    try {
      const dismissed = localStorage.getItem(this.DISMISSAL_KEY);
      if (!dismissed) {
        return false;
      }

      const dismissalData = JSON.parse(dismissed);
      const dismissedAt = dismissalData.timestamp;
      const now = Date.now();
      
      // Check if 30 days have passed since dismissal
      if (now - dismissedAt > this.DISMISSAL_DURATION_MS) {
        // Dismissal has expired, remove it
        this.clearDismissal();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking warning dismissal:', error);
      // If there's an error reading the dismissal, clear it and show the warning
      this.clearDismissal();
      return false;
    }
  }

  /**
   * Dismiss the Ollama warning for 30 days
   */
  dismissWarning(): void {
    try {
      const dismissalData = {
        timestamp: Date.now(),
        dismissedForDays: 30
      };
      localStorage.setItem(this.DISMISSAL_KEY, JSON.stringify(dismissalData));
      console.log('Ollama warning dismissed for 30 days');
    } catch (error) {
      console.error('Error dismissing warning:', error);
    }
  }

  /**
   * Clear the dismissal (for testing or manual reset)
   */
  clearDismissal(): void {
    try {
      localStorage.removeItem(this.DISMISSAL_KEY);
      console.log('Ollama warning dismissal cleared');
    } catch (error) {
      console.error('Error clearing warning dismissal:', error);
    }
  }

  /**
   * Get information about the current dismissal state
   */
  getDismissalInfo(): { isDismissed: boolean; expiresAt?: Date; daysRemaining?: number } {
    try {
      const dismissed = localStorage.getItem(this.DISMISSAL_KEY);
      if (!dismissed) {
        return { isDismissed: false };
      }

      const dismissalData = JSON.parse(dismissed);
      const dismissedAt = dismissalData.timestamp;
      const expiresAt = new Date(dismissedAt + this.DISMISSAL_DURATION_MS);
      const now = Date.now();
      const timeRemaining = (dismissedAt + this.DISMISSAL_DURATION_MS) - now;
      
      if (timeRemaining <= 0) {
        this.clearDismissal();
        return { isDismissed: false };
      }

      const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));

      return {
        isDismissed: true,
        expiresAt,
        daysRemaining
      };
    } catch (error) {
      console.error('Error getting dismissal info:', error);
      this.clearDismissal();
      return { isDismissed: false };
    }
  }
}

export const ollamaWarningService = new OllamaWarningService();
