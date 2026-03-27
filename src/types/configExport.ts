export interface AppConfigExport {
  version: string;
  exportedAt: string;
  environment: object;
  ollama: {
    models: object;
    prompts: object;
    performance: object;
  };
  urlFilters: object;
  rules: object;
  rulesConfig: object;
  emailScoring: {
    data: object;
    actions: object;
  };
  gempest: object;
  memoryList?: string[];
  reinforcingMemoryList?: string[];
  flashCards: object[];
}

export interface ConfigImportResult {
  success: boolean;
  sectionsImported: string[];
  errors: string[];
}

export interface ConfigExportSummary {
  version: string;
  exportedAt: string;
  sections: Array<{
    name: string;
    count: number;
    present: boolean;
  }>;
}
