import type { AppConfigExport, ConfigExportSummary, ConfigImportResult } from '../types/configExport';
import { environmentConfigService } from './environmentConfigService';
import { ollamaService } from './ollamaService';
import { urlFilterService } from './urlFilterService';
import { rulesService } from './rulesService';
import { emailScoringService } from './emailScoringService';
import { gempestService } from './gempestService';
import { flashCardService } from './flashCardService';
import { memoryService } from './memoryService';

class ConfigExportService {
  async exportAllConfig(): Promise<string> {
    const scoringData = emailScoringService.exportData();
    const flashCards = await flashCardService.getAllFlashCards();

    const result: AppConfigExport = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      environment: environmentConfigService.getConfiguration(),
      ollama: {
        models: ollamaService.getModelConfiguration(),
        prompts: ollamaService.getPromptConfiguration(),
        performance: ollamaService.getPerformanceConfiguration(),
      },
      urlFilters: urlFilterService.getConfig(),
      rules: rulesService.getAllRules(),
      rulesConfig: rulesService.getConfig(),
      emailScoring: {
        data: scoringData.scores,
        actions: scoringData.actions,
      },
      gempest: gempestService.getConfig(),
      memoryList: memoryService.getMemoryList(),
      flashCards,
    };

    return JSON.stringify(result, null, 2);
  }

  validateExport(jsonString: string): { valid: boolean; summary: ConfigExportSummary; errors: string[] } {
    const errors: string[] = [];
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(jsonString);
    } catch {
      return {
        valid: false,
        summary: { version: '', exportedAt: '', sections: [] },
        errors: ['Invalid JSON: failed to parse'],
      };
    }

    if (typeof data.version !== 'string') errors.push('Missing or invalid version');
    if (!data.exportedAt || isNaN(Date.parse(data.exportedAt as string))) errors.push('Missing or invalid exportedAt');

    const sectionKeys = ['environment', 'ollama', 'urlFilters', 'rules', 'rulesConfig', 'emailScoring', 'gempest', 'flashCards'];
    for (const key of sectionKeys) {
      if (data[key] === undefined || data[key] === null || typeof data[key] !== 'object') {
        errors.push(`Missing or invalid section: ${key}`);
      }
    }

    const emailScoring = data.emailScoring as Record<string, unknown> | undefined;
    const sections: ConfigExportSummary['sections'] = [
      { name: 'Environment', count: data.environment ? 1 : 0, present: !!data.environment },
      { name: 'Ollama', count: data.ollama ? 1 : 0, present: !!data.ollama },
      { name: 'URL Filter Patterns', count: (data.urlFilters as Record<string, unknown>)?.patterns instanceof Array ? ((data.urlFilters as Record<string, unknown>).patterns as unknown[]).length : 0, present: !!data.urlFilters },
      { name: 'Rules', count: Array.isArray(data.rules) ? data.rules.length : 0, present: Array.isArray(data.rules) },
      { name: 'Rules Config', count: data.rulesConfig ? 1 : 0, present: !!data.rulesConfig },
      { name: 'Email Scoring Senders', count: Array.isArray(emailScoring?.data) ? (emailScoring!.data as unknown[]).length : 0, present: !!data.emailScoring },
      { name: 'Email Scoring Actions', count: Array.isArray(emailScoring?.actions) ? (emailScoring!.actions as unknown[]).length : 0, present: !!data.emailScoring },
      { name: 'Gempest', count: data.gempest ? 1 : 0, present: !!data.gempest },
      { name: 'Memory List', count: Array.isArray(data.memoryList) ? (data.memoryList as unknown[]).length : 0, present: Array.isArray(data.memoryList) },
      { name: 'Flash Cards', count: Array.isArray(data.flashCards) ? data.flashCards.length : 0, present: Array.isArray(data.flashCards) },
    ];

    return {
      valid: errors.length === 0,
      summary: { version: (data.version as string) ?? '', exportedAt: (data.exportedAt as string) ?? '', sections },
      errors,
    };
  }

  async importAllConfig(jsonString: string): Promise<ConfigImportResult> {
    const { valid, errors: validationErrors } = this.validateExport(jsonString);
    if (!valid) return { success: false, sectionsImported: [], errors: validationErrors };

    const data: AppConfigExport = JSON.parse(jsonString);
    const sectionsImported: string[] = [];
    const errors: string[] = [];

    try {
      environmentConfigService.importConfiguration(JSON.stringify(data.environment));
      sectionsImported.push('environment');
    } catch (e) { errors.push(`environment: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ollamaService.setModelConfiguration(data.ollama.models as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ollamaService.setPromptConfiguration(data.ollama.prompts as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ollamaService.setPerformanceConfiguration(data.ollama.performance as any);
      sectionsImported.push('ollama');
    } catch (e) { errors.push(`ollama: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      localStorage.setItem('gmail-reader-url-filters', JSON.stringify(data.urlFilters));
      sectionsImported.push('urlFilters');
    } catch (e) { errors.push(`urlFilters: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      localStorage.setItem('gmail-reader-rules', JSON.stringify(data.rules));
      localStorage.setItem('gmail-reader-rules-config', JSON.stringify(data.rulesConfig));
      sectionsImported.push('rules');
    } catch (e) { errors.push(`rules: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      emailScoringService.importData({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scores: data.emailScoring.data as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: data.emailScoring.actions as any,
      });
      sectionsImported.push('emailScoring');
    } catch (e) { errors.push(`emailScoring: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gempestService.saveConfig(data.gempest as any);
      sectionsImported.push('gempest');
    } catch (e) { errors.push(`gempest: ${e instanceof Error ? e.message : String(e)}`); }

    if (Array.isArray(data.memoryList)) {
      try {
        data.memoryList.forEach((phrase: string) => memoryService.addMemoryItem(phrase));
        sectionsImported.push('memoryList');
      } catch (e) { errors.push(`memoryList: ${e instanceof Error ? e.message : String(e)}`); }
    }

    try {
      const existing = await flashCardService.getAllFlashCards();
      const importResult = await flashCardService.importFlashCards(JSON.stringify({
        version: 1,
        flashCards: data.flashCards,
        tags: []
      }));
      if (importResult.success) {
        for (const card of existing) {
          if (card.id !== undefined) await flashCardService.deleteFlashCard(card.id);
        }
      } else {
        errors.push(`flashCards: Import returned failure — ${importResult.errors.join(', ')}`);
      }
      sectionsImported.push('flashCards');
    } catch (e) { errors.push(`flashCards: ${e instanceof Error ? e.message : String(e)}`); }

    return { success: errors.length === 0, sectionsImported, errors };
  }

  downloadJsonFile(jsonString: string, filename: string): void {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const configExportService = new ConfigExportService();
