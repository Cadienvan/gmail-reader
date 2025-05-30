import type { OllamaModel, OllamaTagsResponse, FlashCard, ModelConfiguration, PromptConfiguration, PerformanceConfiguration, QueuedRequest } from '../types';
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
      // Migrate old configurations that don't have qualityAssessmentPrompt
      if (!this.promptConfig.qualityAssessmentPrompt) {
        const defaultConfig = this.getDefaultPromptConfiguration();
        this.promptConfig.qualityAssessmentPrompt = defaultConfig.qualityAssessmentPrompt;
        this.savePromptConfiguration();
      }
    } else {
      this.promptConfig = this.getDefaultPromptConfiguration();
      this.savePromptConfiguration();
    }

    // Load or initialize performance configuration
    const savedPerformanceConfig = localStorage.getItem(this.PERFORMANCE_CONFIG_KEY);
    if (savedPerformanceConfig) {
      this.performanceConfig = JSON.parse(savedPerformanceConfig);
    } else {
      this.performanceConfig = this.getDefaultPerformanceConfiguration();
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
{CONTENT}`,
      qualityAssessmentPrompt: `You must analyze the provided email content and assess its quality and diversity value for knowledge building. Your response MUST be a valid JSON object with exactly the specified structure.

CRITICAL: Your response must start with { and end with }. Do not include any text before or after the JSON object.

Rate the content on quality (technical depth, actionability, clarity) and diversity (unique perspective, novel information, different domain).

Required JSON structure (copy this exactly):
{
  "contentType": "full-email OR links-only OR mixed",
  "hasLinks": true_or_false,
  "qualityScore": number_0_to_100,
  "diversityScore": number_0_to_100,
  "reasoning": "2-3 sentences explaining the scores"
}

Quality scoring guidelines:
- 80+ (High Quality): Technically substantial, actionable, well-structured, practical insights, credible sources
- 60-79 (Medium Quality): Some valuable content but may lack depth or clarity
- Below 60 (Low Quality): Basic information, unclear, or not actionable

Diversity scoring guidelines:
- 70+ (High Diversity): New perspectives, novel approaches, different domains, expands knowledge
- 50-69 (Medium Diversity): Some new information but within familiar domains
- Below 50 (Low Diversity): Common knowledge or frequently covered topics

Content types:
- "full-email": Contains substantial text content beyond just links
- "links-only": Primarily just links with minimal text
- "mixed": Combination of meaningful text and links

REMEMBER: Respond ONLY with the JSON object. No additional text.

Content to analyze:
{CONTENT}`
    };
  }

  resetPromptConfigurationToDefault(): void {
    this.promptConfig = this.getDefaultPromptConfiguration();
    this.savePromptConfiguration();
    console.log('Prompt configuration reset to defaults with improved quality assessment prompt');
  }

  // Force update quality assessment prompt to the new improved version
  updateQualityAssessmentPrompt(): void {
    const defaultConfig = this.getDefaultPromptConfiguration();
    this.promptConfig.qualityAssessmentPrompt = defaultConfig.qualityAssessmentPrompt;
    this.savePromptConfiguration();
    console.log('Quality assessment prompt updated to improved version');
  }

  // Force refresh the quality assessment prompt to fix any corruption issues
  refreshQualityAssessmentPrompt(): void {
    const defaultConfig = this.getDefaultPromptConfiguration();
    this.promptConfig.qualityAssessmentPrompt = defaultConfig.qualityAssessmentPrompt;
    this.savePromptConfiguration();
    console.log('Quality assessment prompt refreshed to default state');
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

  // Queue management methods
  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
    if (this.isProcessingQueue || 
        this.requestQueue.length === 0 || 
        this.activeRequests >= this.performanceConfig.maxConcurrentRequests) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && 
           this.activeRequests < this.performanceConfig.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (!request) break;

      // Check if request was cancelled
      if (request.signal?.aborted) {
        request.reject(new Error('Request was cancelled'));
        continue;
      }

      this.activeRequests++;
      
      // Process the request
      this.executeQueuedRequest(request).finally(() => {
        this.activeRequests--;
        // Add delay between requests if configured
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
        case 'quality':
          result = await this.executeQualityAssessment(request.content, request.signal);
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
    // Reject all pending requests
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue was cleared'));
    });
    this.requestQueue = [];
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

  async generateQualityAssessment(content: string, signal?: AbortSignal): Promise<any> {
    // Use the queue system if enabled for performance management
    if (this.performanceConfig.enableQueueMode) {
      return this.addToQueue<any>('quality', content, signal);
    }

    // Direct execution if queue mode is disabled
    return this.executeQualityAssessment(content, signal);
  }

  private async executeQualityAssessment(content: string, signal?: AbortSignal): Promise<any> {
    try {
      // Ensure we have a quality assessment prompt
      if (!this.promptConfig.qualityAssessmentPrompt) {
        const defaultConfig = this.getDefaultPromptConfiguration();
        this.promptConfig.qualityAssessmentPrompt = defaultConfig.qualityAssessmentPrompt;
        this.savePromptConfiguration();
      }
      
      // Use a simplified and more reliable prompt to ensure JSON consistency
      const simplifiedPrompt = `You are a content quality analyzer. You must respond ONLY with a valid JSON object.

Analyze this email content and return a JSON object with this exact structure:

{
  "contentType": "full-email",
  "hasLinks": true,
  "qualityScore": 75,
  "diversityScore": 65,
  "reasoning": "Brief explanation of the scores"
}

Rules:
- contentType: "full-email" (substantial text), "links-only" (mostly links), or "mixed" (both)
- hasLinks: true if contains URLs, false otherwise
- qualityScore: 0-100 (technical depth, actionability, clarity)
- diversityScore: 0-100 (unique perspective, novelty)
- reasoning: 1-2 sentences explaining the scores

Respond ONLY with the JSON object. No other text.

Content:
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}`;
      
      // Use detailed model for quality assessment (better instruction following and JSON consistency)
      const modelToUse = this.modelConfig.detailed;
      
      const response = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt: simplifiedPrompt,
          stream: false,
          options: {
            temperature: 0.1, // Lower temperature for more consistent responses
            num_predict: 200, // Limit response length to encourage JSON only
            stop: ['\n\n', 'Content:', 'Rules:'] // Stop tokens to prevent extra text
          }
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Quality assessment raw response:', data.response);
      
      if (data && data.response) {
        try {
          // Clean response by removing think tags if present
          let cleanResponse = data.response.trim();
          if (cleanResponse.includes('<think>')) {
            const thinkStart = cleanResponse.indexOf('<think>');
            const thinkEnd = cleanResponse.indexOf('</think>');
            if (thinkEnd !== -1) {
              cleanResponse = cleanResponse.substring(0, thinkStart) + cleanResponse.substring(thinkEnd + 8);
            }
          }
          
          // Remove common prefixes that might interfere
          cleanResponse = cleanResponse.replace(/^(Here's the JSON|Here is the JSON|The JSON response is:|Response:|Analysis:|Assessment:)/i, '').trim();
          
          // Find JSON boundaries more robustly
          const jsonStart = cleanResponse.indexOf('{');
          const jsonEnd = cleanResponse.lastIndexOf('}');
          
          if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
            console.warn('No valid JSON delimiters found, trying full response parse');
            // Try parsing the entire response as JSON
            const result = JSON.parse(cleanResponse);
            return this.validateAndFixQualityResult(result, content);
          }
          
          const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
          console.log('Extracted JSON string:', jsonString);
          
          const result = JSON.parse(jsonString);
          return this.validateAndFixQualityResult(result, content);
          
        } catch (parseError) {
          console.error('Failed to parse quality assessment JSON:', parseError);
          console.error('Raw response:', data.response);
          
          // Try to extract JSON using regex as last resort
          const jsonMatch = data.response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]);
              return this.validateAndFixQualityResult(result, content);
            } catch (regexParseError) {
              console.error('Regex extracted JSON also failed to parse:', regexParseError);
            }
          }
          
          // Enhanced fallback response with content analysis
          return this.createFallbackQualityResult(content, parseError);
        }
      } else {
        throw new Error('No response received from Ollama');
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Quality assessment was cancelled');
      }
      
      console.error('Ollama quality assessment error:', error);
      throw new Error(`Failed to generate quality assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateAndFixQualityResult(result: any, content: string): any {
    // Validate required fields and types
    const requiredFields = ['contentType', 'hasLinks', 'qualityScore', 'diversityScore', 'reasoning'];
    for (const field of requiredFields) {
      if (!(field in result)) {
        console.warn(`Missing required field: ${field}, adding default`);
      }
    }
    
    // Validate and fix field types and constraints
    if (!['full-email', 'links-only', 'mixed'].includes(result.contentType)) {
      result.contentType = 'full-email'; // Default fallback
    }
    
    if (typeof result.hasLinks !== 'boolean') {
      result.hasLinks = content.includes('http') || content.includes('www.');
    }
    
    if (typeof result.qualityScore !== 'number' || result.qualityScore < 0 || result.qualityScore > 100) {
      result.qualityScore = Math.max(0, Math.min(100, Number(result.qualityScore) || 50));
    }
    
    if (typeof result.diversityScore !== 'number' || result.diversityScore < 0 || result.diversityScore > 100) {
      result.diversityScore = Math.max(0, Math.min(100, Number(result.diversityScore) || 50));
    }
    
    if (typeof result.reasoning !== 'string' || result.reasoning.length === 0) {
      result.reasoning = 'Assessment completed with automatic validation';
    }
    
    return result;
  }

  private createFallbackQualityResult(content: string, error: any): any {
    const hasLinks = content.includes('http') || content.includes('www.');
    const contentLength = content.length;
    const hasStructure = content.includes('\n') || content.includes('•') || content.includes('-');
    
    return {
      contentType: hasLinks && contentLength < 500 ? 'links-only' : hasLinks ? 'mixed' : 'full-email',
      hasLinks: hasLinks,
      qualityScore: contentLength > 1000 && hasStructure ? 60 : 40,
      diversityScore: hasLinks ? 55 : 45,
      reasoning: `Fallback assessment due to parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // Private execution methods for queue integration
  private async executeDirectSummary(content: string, signal?: AbortSignal): Promise<string> {
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
  }

  private async executeDirectImprovedSummary(content: string, signal?: AbortSignal): Promise<string> {
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
  }

  private async executeDirectFlashCards(content: string, signal?: AbortSignal): Promise<FlashCard[]> {
    const modelToUse = this.modelConfig.detailed;
    const prompt = this.promptConfig.flashCardPrompt.replace('{CONTENT}', content);
    
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
        const parsed = JSON.parse(data.response);
        if (Array.isArray(parsed)) {
          return parsed;
        } else {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        throw new Error('Failed to parse flash cards JSON response');
      }
    } else {
      throw new Error('Invalid response from Ollama');
    }
  }

  // Method to clear model context to prevent context pollution
  private async clearModelContext(modelName: string): Promise<void> {
    try {
      // Send a simple reset prompt to clear any accumulated context
      await fetch(`${this.getBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Clear context. Respond only: OK',
          stream: false,
          options: {
            num_predict: 5,
            temperature: 0
          }
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      // Silently ignore context clearing errors as this is best-effort
      console.debug('Context clearing failed (non-critical):', error);
    }
  }

  // Enhanced quality assessment with context clearing
  async generateQualityAssessmentWithContextClear(content: string, signal?: AbortSignal): Promise<any> {
    // Clear context before assessment to prevent pollution from previous interactions
    await this.clearModelContext(this.modelConfig.detailed);
    
    // Small delay to ensure context is cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return this.generateQualityAssessment(content, signal);
  }

  // Diagnostic method to test quality assessment consistency
  async testQualityAssessmentConsistency(): Promise<void> {
    const testContent = `
Subject: Advanced TypeScript Patterns for Large Scale Applications

Hey there!

I wanted to share some advanced TypeScript patterns that have been really helpful in our large-scale applications. Here are some key techniques:

1. **Conditional Types**: These allow you to create types that depend on other types
2. **Mapped Types**: Great for transforming existing types
3. **Template Literal Types**: Powerful for creating string-based type systems

Links for further reading:
- https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
- https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
- https://devblogs.microsoft.com/typescript/announcing-typescript-4-1/

These patterns have helped us maintain type safety while keeping our code flexible and maintainable.

Best regards,
Senior Developer
    `;

    console.log('=== Quality Assessment Consistency Test ===');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Test ${i} ---`);
      try {
        const result = await this.generateQualityAssessmentWithContextClear(testContent);
        console.log(`Test ${i} Result:`, JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`Test ${i} Failed:`, error);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Test Complete ===');
  }

  // Method to reproduce JSON format degradation issue for debugging
  async debugQualityAssessmentIssue(): Promise<void> {
    console.log('=== JSON Format Degradation Debug ===');
    
    const testEmail = `
From: tech.newsletter@example.com
Subject: Advanced React Patterns and Performance Optimization

Hi developers!

This week's newsletter covers advanced React patterns that can significantly improve your application performance:

1. **React.memo() and useMemo()**: Prevent unnecessary re-renders
2. **Code Splitting**: Lazy load components to reduce bundle size  
3. **Virtual DOM optimization**: Understanding React's reconciliation

Key articles:
- https://react.dev/reference/react/memo
- https://react.dev/reference/react/useMemo
- https://web.dev/code-splitting/

These patterns have helped teams reduce their app load times by 40-60%.

Happy coding!
The React Team
    `;

    for (let i = 1; i <= 5; i++) {
      console.log(`\n--- Test ${i}: Quality Assessment ---`);
      
      try {
        console.log('Calling generateQualityAssessment...');
        const startTime = Date.now();
        const result = await this.generateQualityAssessment(testEmail);
        const duration = Date.now() - startTime;
        
        console.log(`Test ${i} completed in ${duration}ms`);
        console.log('Result type:', typeof result);
        console.log('Result structure:', Object.keys(result));
        console.log('Full result:', JSON.stringify(result, null, 2));
        
        // Validate JSON structure
        const isValidJSON = typeof result === 'object' && 
                           result !== null &&
                           'contentType' in result &&
                           'qualityScore' in result &&
                           'diversityScore' in result;
                           
        console.log('Is valid JSON structure:', isValidJSON);
        
        if (!isValidJSON) {
          console.error('❌ INVALID JSON STRUCTURE DETECTED!');
          console.error('Expected object with required fields, got:', result);
        } else {
          console.log('✅ Valid JSON structure');
        }
        
      } catch (error) {
        console.error(`❌ Test ${i} failed:`, error);
      }
      
      // Wait between tests to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n=== Debug Complete ===');
  }
}

export const ollamaService = new OllamaService();
