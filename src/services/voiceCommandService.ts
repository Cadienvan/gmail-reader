// Voice Command Service for Gmail Email Traversal
// Provides speech recognition and voice commands for hands-free navigation

// TypeScript interfaces for Speech Recognition API
interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
  readonly length: number;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length: number;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

// Global declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export interface VoiceCommand {
  pattern: RegExp;
  action: string;
  description: string;
  examples: string; // Human-readable examples of the command
}

export interface VoiceCommandCallbacks {
  onNext: () => void;
  onPrevious: () => void;
  onStartTraversal: () => void;
  onStopTraversal: () => void;
  onShowLog: () => void;
  onShowFlashCards: () => void;
  onClose: () => void;
  onRefresh: () => void;
}

class VoiceCommandService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private callbacks: VoiceCommandCallbacks | null = null;
  private commands: VoiceCommand[] = [
    {
      pattern: /\b(next|successivo|avanti|dopo)\b/i,
      action: 'next',
      description: 'Navigate to next email',
      examples: 'next, successivo, avanti, dopo'
    },
    {
      pattern: /\b(previous|precedente|indietro|prima)\b/i,
      action: 'previous', 
      description: 'Navigate to previous email',
      examples: 'previous, precedente, indietro, prima'
    },
    {
      pattern: /\b(start|inizia|comincia|apri)\s+(traversal|navigazione|email)\b/i,
      action: 'startTraversal',
      description: 'Start email traversal',
      examples: 'start traversal, inizia navigazione, comincia email, apri email'
    },
    {
      pattern: /\b(stop|ferma|chiudi|esci)\s*(traversal|navigazione|email)?\b/i,
      action: 'stopTraversal',
      description: 'Stop email traversal',
      examples: 'stop traversal, ferma navigazione, chiudi email, esci'
    },
    {
      pattern: /\b(show|mostra|visualizza|apri)\s+(log|storia|cronologia|history)\b/i,
      action: 'showLog',
      description: 'Show email log',
      examples: 'show log, mostra storia, visualizza cronologia, apri history'
    },
    {
      pattern: /\b(show|mostra|visualizza|apri)\s+(flash|card|flashcard|carte)\b/i,
      action: 'showFlashCards',
      description: 'Show flashcards',
      examples: 'show flashcard, mostra carte, visualizza flash, apri card'
    },
    {
      pattern: /\b(close|chiudi|esci)\b/i,
      action: 'close',
      description: 'Close current modal',
      examples: 'close, chiudi, esci'
    },
    {
      pattern: /\b(refresh|aggiorna|ricarica|reload)\b/i,
      action: 'refresh',
      description: 'Refresh emails',
      examples: 'refresh, aggiorna, ricarica, reload'
    }
  ];

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionConstructor();
    
    this.recognition!.continuous = true;
    this.recognition!.interimResults = false;
    this.recognition!.lang = 'it-IT'; // Primary language Italian
    
    // Add English as fallback
    if (this.recognition!.lang !== 'en-US') {
      setTimeout(() => {
        if (this.recognition) {
          this.recognition.lang = 'en-US';
        }
      }, 100);
    }

    this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      console.log('Voice command detected:', transcript);
      this.processCommand(transcript);
    };

    this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'network') {
        this.showNotification('Network error in voice recognition', 'error');
      }
    };

    this.recognition!.onend = () => {
      if (this.isListening) {
        // Restart recognition if we're still supposed to be listening
        setTimeout(() => {
          if (this.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch (error) {
              console.error('Failed to restart recognition:', error);
            }
          }
        }, 100);
      }
    };
  }

  public setCallbacks(callbacks: VoiceCommandCallbacks): void {
    this.callbacks = callbacks;
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.showNotification('Voice recognition not available', 'error');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      this.showNotification('Voice commands active', 'success');
      return true;
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      this.showNotification('Failed to start voice recognition', 'error');
      return false;
    }
  }

  public stopListening(): void {
    if (!this.recognition || !this.isListening) {
      return;
    }

    this.recognition.stop();
    this.isListening = false;
    this.showNotification('Voice commands disabled', 'info');
  }

  public toggleListening(): boolean {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      return this.startListening();
    }
  }

  public isActive(): boolean {
    return this.isListening;
  }

  private processCommand(transcript: string): void {
    if (!this.callbacks) {
      console.warn('No callbacks set for voice commands');
      return;
    }

    for (const command of this.commands) {
      if (command.pattern.test(transcript)) {
        console.log(`Executing voice command: ${command.action}`);
        this.executeCommand(command.action);
        this.showNotification(`Command executed: ${command.description}`, 'success');
        return;
      }
    }

    console.log('No matching command found for:', transcript);
  }

  private executeCommand(action: string): void {
    if (!this.callbacks) return;

    switch (action) {
      case 'next':
        this.callbacks.onNext();
        break;
      case 'previous':
        this.callbacks.onPrevious();
        break;
      case 'startTraversal':
        this.callbacks.onStartTraversal();
        break;
      case 'stopTraversal':
        this.callbacks.onStopTraversal();
        break;
      case 'showLog':
        this.callbacks.onShowLog();
        break;
      case 'showFlashCards':
        this.callbacks.onShowFlashCards();
        break;
      case 'close':
        this.callbacks.onClose();
        break;
      case 'refresh':
        this.callbacks.onRefresh();
        break;
      default:
        console.warn('Unknown command action:', action);
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 transition-opacity duration-300 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  public getSupportedCommands(): VoiceCommand[] {
    return [...this.commands];
  }

  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export const voiceCommandService = new VoiceCommandService();
