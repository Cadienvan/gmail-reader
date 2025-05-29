import type { OllamaModel, OllamaTagsResponse, FlashCard, ModelConfiguration, PromptConfiguration } from '../types';
import { environmentConfigService } from './environmentConfigService';

class OllamaService {
  private getBaseUrl(): string {
    return environmentConfigService.getOllamaBaseUrl();
  }
  private readonly MODEL_CONFIG_KEY = 'ollama-model-configuration';
  private readonly PROMPT_CONFIG_KEY = 'ollama-prompt-configuration';
  private modelConfig: ModelConfiguration;
  private promptConfig: PromptConfiguration;

  constructor() {
    // Load or initialize model configuration
    const savedConfig = localStorage.getItem(this.MODEL_CONFIG_KEY);
    if (savedConfig) {
      this.modelConfig = JSON.parse(savedConfig);
      // Migrate old config format if needed
      if ('currentModel' in this.modelConfig || 'memoryThreshold' in this.modelConfig || 'autoSwitch' in this.modelConfig || 'shortTerm' in this.modelConfig || 'longTerm' in this.modelConfig) {
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
    const savedPromptConfig = localStorage.getItem(this.PROMPT_CONFIG_KEY);
    if (savedPromptConfig) {
      this.promptConfig = JSON.parse(savedPromptConfig);
    } else {
      this.promptConfig = this.getDefaultPromptConfiguration();
      this.savePromptConfiguration();
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
  }

  getCurrentModelInfo(): { config: ModelConfiguration } {
    return {
      config: { ...this.modelConfig }
    };
  }

  // Legacy methods for backward compatibility - delegate to double model configuration
  getSelectedModel(): string {
    // Return the quick model as the "default" selected model
    return this.modelConfig.quick;
  }

  setSelectedModel(model: string): void {
    // Update both models to the same value for simplicity
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

  async generateSummary(content: string, signal?: AbortSignal): Promise<string> {
    try {
      // Always use quick model initially
      const modelToUse = this.modelConfig.quick;
      const prompt = this.promptConfig.summaryPrompt.replace('{CONTENT}', content);
      
      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
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
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Summary generation was cancelled');
      }
      
      console.error('Ollama service error:', error);
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(`Ollama service is not running. Please start Ollama and ensure the ${this.modelConfig.quick} model is available.`);
        }
      }
      if (error instanceof Response && error.status === 404) {
        throw new Error(`Ollama model not found. Please ensure ${this.modelConfig.quick} is installed.`);
      }
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateImprovedSummary(content: string, signal?: AbortSignal): Promise<string> {
    try {
      // Use detailed model for improved summary
      const modelToUse = this.modelConfig.detailed;
      const prompt = this.promptConfig.summaryPrompt.replace('{CONTENT}', content);
      
      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
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
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Improved summary generation was cancelled');
      }
      
      console.error('Ollama service error:', error);
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(`Ollama service is not running. Please start Ollama and ensure the ${this.modelConfig.detailed} model is available.`);
        }
      }
      if (error instanceof Response && error.status === 404) {
        throw new Error(`Ollama model not found. Please ensure ${this.modelConfig.detailed} is installed.`);
      }
      throw new Error(`Failed to generate improved summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to check if an improved summary is available
  canUpgradeSummary(): boolean {
    return this.modelConfig.quick !== this.modelConfig.detailed;
  }

  async generateFlashCards(content: string, signal?: AbortSignal): Promise<FlashCard[]> {
    try {
      const prompt = this.promptConfig.flashCardPrompt.replace('{CONTENT}', content);
      // Use quick model for flash cards (faster)
      const modelToUse = this.modelConfig.quick;
      
      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
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
          // Remove think tags if present, similar to summary generation
          let cleanResponse = data.response;
          if (cleanResponse.includes('</think>')) {
            const thinkEndIndex = cleanResponse.indexOf('</think>');
            cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
          }

          // Try to parse the JSON response
          const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const flashCardsData = JSON.parse(jsonMatch[0]);
            return flashCardsData.map((card: any, index: number) => ({
              question: card.question || `Question ${index + 1}`,
              answer: card.answer || 'No answer provided',
              sourceType: 'link' as const,
              sourceId: ''
            }));
          } else {
            throw new Error('No valid JSON array found in response');
          }
        } catch (parseError) {
          console.error('Failed to parse flash cards JSON:', parseError);
          // Fallback: create a single card with the entire response (also clean of think tags)
          let cleanResponse = data.response;
          if (cleanResponse.includes('</think>')) {
            const thinkEndIndex = cleanResponse.indexOf('</think>');
            cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
          }
          
          return [{
            question: 'Key insights from the content',
            answer: cleanResponse,
            sourceType: 'link' as const,
            sourceId: ''
          }];
        }
      } else {
        throw new Error('No response received from Ollama');
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Flash card generation was cancelled');
      }
      
      console.error('Ollama flash cards generation error:', error);
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('Ollama service is not running. Please start it with: ollama serve');
        }
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
        // Check if both configured models are available
        const hasQuickModel = data.models.some((model: any) => 
          model.name === this.modelConfig.quick || model.model === this.modelConfig.quick
        );
        const hasDetailedModel = data.models.some((model: any) => 
          model.name === this.modelConfig.detailed || model.model === this.modelConfig.detailed
        );
        return hasQuickModel && hasDetailedModel;
      }
      return false;
    } catch (error) {
      console.error('Ollama availability check failed:', error);
      return false;
    }
  }
}

export const ollamaService = new OllamaService();
