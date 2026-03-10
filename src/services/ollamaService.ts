import type {
  OllamaModel,
  OllamaTagsResponse,
  FlashCard,
  ModelConfiguration,
  PromptConfiguration,
  PerformanceConfiguration,
  QueuedRequest
} from '../types';
import { environmentConfigService } from './environmentConfigService';

class OllamaService {
  private getBaseUrl(): string {
    return environmentConfigService.getOllamaBaseUrl();
  }

  private readonly MODEL_CONFIG_KEY = 'ollama-model-configuration';
  private readonly PROMPT_CONFIG_KEY = 'ollama-prompt-configuration';
  private readonly PERFORMANCE_CONFIG_KEY = 'ollama-performance-configuration';

  private modelConfig: ModelConfiguration;
  private promptConfig: PromptConfiguration;
  private performanceConfig: PerformanceConfiguration;

  // Queue management
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private activeRequests = 0;

  constructor() {
    // Load or initialize model configuration
    const savedConfig = localStorage.getItem(this.MODEL_CONFIG_KEY);
    if (savedConfig) {
      this.modelConfig = JSON.parse(savedConfig);

      // Migrate old config format if needed
      if (
        'currentModel' in this.modelConfig ||
        'memoryThreshold' in this.modelConfig ||
        'autoSwitch' in this.modelConfig ||
        'shortTerm' in this.modelConfig ||
        'longTerm' in this.modelConfig
      ) {
        const oldConfig = this.modelConfig as any;
        this.modelConfig = {
          quick: oldConfig.quick || oldConfig.shortTerm || 'deepseek-r1:1.5b',
          detailed: oldConfig.detailed || oldConfig.longTerm || 'deepseek-r1:1.5b'
        };
        this.saveModelConfiguration();
      }
    } else {
      this.modelConfig = {
        quick: 'deepseek-r1:1.5b',
        detailed: 'deepseek-r1:1.5b'
      };
      this.saveModelConfiguration();
    }

    // Load or initialize prompt configuration
    const defaultPromptConfig = this.getDefaultPromptConfiguration();
    const savedPromptConfig = localStorage.getItem(this.PROMPT_CONFIG_KEY);
    if (savedPromptConfig) {
      const parsed = JSON.parse(savedPromptConfig) as Partial<PromptConfiguration>;
      this.promptConfig = {
        ...defaultPromptConfig,
        ...parsed
      };
      this.savePromptConfiguration();
    } else {
      this.promptConfig = defaultPromptConfig;
      this.savePromptConfiguration();
    }

    // Load or initialize performance configuration
    const defaultPerformanceConfig = this.getDefaultPerformanceConfiguration();
    const savedPerformanceConfig = localStorage.getItem(this.PERFORMANCE_CONFIG_KEY);
    if (savedPerformanceConfig) {
      const parsed = JSON.parse(savedPerformanceConfig) as Partial<PerformanceConfiguration>;
      this.performanceConfig = {
        ...defaultPerformanceConfig,
        ...parsed
      };
      this.savePerformanceConfiguration();
    } else {
      this.performanceConfig = defaultPerformanceConfig;
      this.savePerformanceConfiguration();
    }
  }

  getModelConfiguration(): ModelConfiguration {
    return { ...this.modelConfig };
  }

  setModelConfiguration(config: ModelConfiguration): void {
    this.modelConfig = { ...config };
    this.saveModelConfiguration();
  }

  private saveModelConfiguration(): void {
    localStorage.setItem(this.MODEL_CONFIG_KEY, JSON.stringify(this.modelConfig));
  }

  getPromptConfiguration(): PromptConfiguration {
    return { ...this.promptConfig };
  }

  setPromptConfiguration(config: PromptConfiguration): void {
    this.promptConfig = { ...config };
    this.savePromptConfiguration();
  }

  private savePromptConfiguration(): void {
    localStorage.setItem(this.PROMPT_CONFIG_KEY, JSON.stringify(this.promptConfig));
  }

  getPerformanceConfiguration(): PerformanceConfiguration {
    return { ...this.performanceConfig };
  }

  setPerformanceConfiguration(config: PerformanceConfiguration): void {
    this.performanceConfig = { ...config };
    this.savePerformanceConfiguration();
  }

  private savePerformanceConfiguration(): void {
    localStorage.setItem(this.PERFORMANCE_CONFIG_KEY, JSON.stringify(this.performanceConfig));
  }

  private getDefaultPerformanceConfiguration(): PerformanceConfiguration {
    return {
      enableQueueMode: false,
      maxConcurrentRequests: 1,
      requestDelay: 1000
    };
  }

  private getDefaultPromptConfiguration(): PromptConfiguration {
    return {
      summaryPrompt: `Act as an experienced Software Engineer with software architecture skills and great leadership who is helping me with my study. Your background is highly humanistic and this should help me to grasp not only the technical aspects of what I send you, but also the leadership and, in general, human aspects.

I will provide you an article in the form of full content, and I would like you to indicate 3 to 10 key points based on how many you think are correct to extract and that I should remember carefully. Always try to propose an example of a team context which could benefit from the key points. These key points should be accompanied by any additional material if you deem it valuable.

These summaries will be used by me to reduce the time necessary for me to spend on the study.

Feel free to suggest technical terms or frameworks/methodologies to learn. I have technical skills and I am learning the world of Product Management and Leadership.

The answer should be structured like this:
- Key point 1
- Key point 2 (If present)
- Key point 3 (If present)
- Framework/methodology to explore further (If you deem it necessary)
- Any articles or supporting material to explore further

If you need any kind of information, I am available.

Try to be concise, my time is limited, but at the same time do not leave out important details. I would say to try to stay around 10% of the size of the content I will send you:

---

{CONTENT}`,
      flashCardPrompt: `Create 5-7 educational flash cards based on the provided content. Focus on the most important concepts, technical details, best practices, or key insights that a software engineer should remember.

IMPORTANT INSTRUCTIONS:
- Create self-contained questions that make sense without referring to "this article", "the content", "this document", or similar references
- Questions should be standalone and clear to someone reviewing them later
- Focus on transferable knowledge and concepts rather than article-specific details
- Make answers informative but concise

Format your response as a JSON array of objects with "question" and "answer" properties.

Example format:
[
  {
    "question": "What are the main benefits of using microservices architecture?",
    "answer": "Microservices allow for independent deployment, scaling, and technology choices for different parts of an application, improving maintainability and team autonomy."
  },
  {
    "question": "What is the difference between authentication and authorization in web security?",
    "answer": "Authentication verifies who a user is (login), while authorization determines what permissions they have (access control). Authentication comes first, then authorization."
  }
]

Content to analyze:
{CONTENT}`
    };
  }

  resetPromptConfigurationToDefault(): void {
    this.promptConfig = this.getDefaultPromptConfiguration();
    this.savePromptConfiguration();
    console.log('Prompt configuration reset to defaults');
  }

  getCurrentModelInfo(): { config: ModelConfiguration } {
    return {
      config: { ...this.modelConfig }
    };
  }

  // Legacy methods for backward compatibility
  getSelectedModel(): string {
    return this.modelConfig.quick;
  }

  setSelectedModel(model: string): void {
    this.modelConfig = {
      quick: model,
      detailed: model
    };
    this.saveModelConfiguration();
  }

  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaTagsResponse = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      return [];
    }
  }

  // Queue management methods
  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private async addToQueue<T>(
    type: QueuedRequest['type'],
    content: string,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateRequestId(),
        type,
        content,
        resolve: resolve as (result: any) => void,
        reject,
        signal,
        addedAt: Date.now()
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (
      this.isProcessingQueue ||
      this.requestQueue.length === 0 ||
      this.activeRequests >= this.performanceConfig.maxConcurrentRequests
    ) {
      return;
    }

    this.isProcessingQueue = true;

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.performanceConfig.maxConcurrentRequests
    ) {
      const request = this.requestQueue.shift();
      if (!request) {
        break;
      }

      if (request.signal?.aborted) {
        request.reject(new Error('Request was cancelled'));
        continue;
      }

      this.activeRequests++;

      this.executeQueuedRequest(request).finally(() => {
        this.activeRequests--;
        if (this.performanceConfig.requestDelay > 0 && this.requestQueue.length > 0) {
          setTimeout(() => this.processQueue(), this.performanceConfig.requestDelay);
        } else {
          this.processQueue();
        }
      });
    }

    this.isProcessingQueue = false;
  }

  private async executeQueuedRequest(request: QueuedRequest): Promise<void> {
    try {
      let result: any;

      switch (request.type) {
        case 'summary':
          result = await this.executeDirectSummary(request.content, request.signal);
          break;
        case 'improved-summary':
          result = await this.executeDirectImprovedSummary(request.content, request.signal);
          break;
        case 'flashcard':
          result = await this.executeDirectFlashCards(request.content, request.signal);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      request.resolve(result);
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getQueueStatus(): { queueLength: number; activeRequests: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.isProcessingQueue
    };
  }

  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue was cleared'));
    });
    this.requestQueue = [];
  }

  async generateSummary(content: string, signal?: AbortSignal): Promise<string> {
    if (this.performanceConfig.enableQueueMode) {
      return this.addToQueue<string>('summary', content, signal);
    }

    return this.executeDirectSummary(content, signal);
  }

  async generateImprovedSummary(content: string, signal?: AbortSignal): Promise<string> {
    if (this.performanceConfig.enableQueueMode) {
      return this.addToQueue<string>('improved-summary', content, signal);
    }

    return this.executeDirectImprovedSummary(content, signal);
  }

  canUpgradeSummary(): boolean {
    return this.modelConfig.quick !== this.modelConfig.detailed;
  }

  async generateFlashCards(content: string, signal?: AbortSignal): Promise<FlashCard[]> {
    try {
      const prompt = this.promptConfig.flashCardPrompt.replace('{CONTENT}', content);
      const modelToUse = this.modelConfig.quick;

      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt,
          stream: false
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.response) {
        try {
          let cleanResponse = data.response;
          if (cleanResponse.includes('</think>')) {
            const thinkEndIndex = cleanResponse.indexOf('</think>');
            cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
          }

          const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const flashCardsData = JSON.parse(jsonMatch[0]);
            return flashCardsData.map((card: any, index: number) => ({
              question: card.question || `Question ${index + 1}`,
              answer: card.answer || 'No answer provided',
              sourceType: 'link' as const,
              sourceId: ''
            }));
          }

          throw new Error('No valid JSON array found in response');
        } catch (parseError) {
          console.error('Failed to parse flash cards JSON:', parseError);

          let cleanResponse = data.response;
          if (cleanResponse.includes('</think>')) {
            const thinkEndIndex = cleanResponse.indexOf('</think>');
            cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
          }

          return [
            {
              question: 'Key insights from the content',
              answer: cleanResponse,
              sourceType: 'link' as const,
              sourceId: ''
            }
          ];
        }
      }

      throw new Error('No response received from Ollama');
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Flash card generation was cancelled');
      }

      console.error('Ollama flash cards generation error:', error);
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Ollama service is not running. Please start it with: ollama serve');
      }

      if (error instanceof Response && error.status === 404) {
        throw new Error(`Model "${this.modelConfig.quick}" not found. Please install it with: ollama pull ${this.modelConfig.quick}`);
      }

      throw new Error(`Failed to generate flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data && data.models) {
        const hasQuickModel = data.models.some((model: any) => {
          return model.name === this.modelConfig.quick || model.model === this.modelConfig.quick;
        });

        const hasDetailedModel = data.models.some((model: any) => {
          return model.name === this.modelConfig.detailed || model.model === this.modelConfig.detailed;
        });

        return hasQuickModel && hasDetailedModel;
      }

      return false;
    } catch (error) {
      console.error('Ollama availability check failed:', error);
      return false;
    }
  }

  // Private execution methods for queue integration
  private async executeDirectSummary(content: string, signal?: AbortSignal): Promise<string> {
    try {
      const modelToUse = this.modelConfig.quick;
      const prompt = this.promptConfig.summaryPrompt.replace('{CONTENT}', content);

      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt,
          stream: false
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.response) {
        return data.response;
      }

      throw new Error('Invalid response from Ollama');
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Summary generation was cancelled');
      }

      console.error('Ollama service error:', error);
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Ollama service is not running. Please start Ollama and ensure the ${this.modelConfig.quick} model is available.`);
      }

      if (error instanceof Response && error.status === 404) {
        throw new Error(`Ollama model not found. Please ensure ${this.modelConfig.quick} is installed.`);
      }

      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeDirectImprovedSummary(content: string, signal?: AbortSignal): Promise<string> {
    try {
      const modelToUse = this.modelConfig.detailed;
      const prompt = this.promptConfig.summaryPrompt.replace('{CONTENT}', content);

      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt,
          stream: false
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.response) {
        return data.response;
      }

      throw new Error('Invalid response from Ollama');
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Improved summary generation was cancelled');
      }

      console.error('Ollama service error:', error);
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Ollama service is not running. Please start Ollama and ensure the ${this.modelConfig.detailed} model is available.`);
      }

      if (error instanceof Response && error.status === 404) {
        throw new Error(`Ollama model not found. Please ensure ${this.modelConfig.detailed} is installed.`);
      }

      throw new Error(`Failed to generate improved summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeDirectFlashCards(content: string, signal?: AbortSignal): Promise<FlashCard[]> {
    const modelToUse = this.modelConfig.detailed;
    const prompt = this.promptConfig.flashCardPrompt.replace('{CONTENT}', content);

    const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: false
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.response) {
      const parsed = JSON.parse(data.response);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error('Response is not an array');
    }

    throw new Error('Invalid response from Ollama');
  }
}

export const ollamaService = new OllamaService();