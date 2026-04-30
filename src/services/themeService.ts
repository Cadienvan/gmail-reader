class ThemeService {
  private readonly DARK_CLASS = 'dark';

  applyDarkMode(enabled: boolean): void {
    document.documentElement.classList.toggle(this.DARK_CLASS, enabled);
  }
}

export const themeService = new ThemeService();
