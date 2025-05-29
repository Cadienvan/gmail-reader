// Storage service for persistent data using IndexedDB
import type { FlashCardTag, FlashCard } from '../types';

interface StoredTab {
  url: string;
  title?: string;
  content?: string;
  summary?: string;
  error?: string;
  lastOpened: number;
  summaryRequested: boolean;
  summaryReady: boolean;
}

interface StoredFlashCard {
  id?: number;
  question: string;
  answer: string;
  sourceUrl?: string;
  sourceType: 'link' | 'email';
  sourceId: string;
  createdAt: string;
}

interface FlashCardTagRelation {
  cardId: number;
  tagId: number;
}

class DBStorageService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'gmail-reader-db';
  private readonly DB_VERSION = 2; // Incremented to add flashcard stores
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<boolean> {
    if (this.initialized) return true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = (event) => {
        console.error("Database error:", (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.initialized = true;
        resolve(true);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create tabs store
        if (!db.objectStoreNames.contains('tabs')) {
          const tabStore = db.createObjectStore('tabs', { keyPath: 'url' });
          tabStore.createIndex('lastOpened', 'lastOpened', { unique: false });
        }

        // Create flashcard tags store
        if (!db.objectStoreNames.contains('flash_card_tags')) {
          const tagStore = db.createObjectStore('flash_card_tags', { keyPath: 'id', autoIncrement: true });
          tagStore.createIndex('name', 'name', { unique: true });
        }

        // Create flashcards store
        if (!db.objectStoreNames.contains('flash_cards')) {
          const cardStore = db.createObjectStore('flash_cards', { keyPath: 'id', autoIncrement: true });
          cardStore.createIndex('sourceType', 'sourceType', { unique: false });
          cardStore.createIndex('sourceId', 'sourceId', { unique: false });
          cardStore.createIndex('createdAt', 'createdAt', { unique: false });
          cardStore.createIndex('sourceTypeAndId', ['sourceType', 'sourceId'], { unique: false });
        }

        // Create flashcard-tag relationships store
        if (!db.objectStoreNames.contains('flash_card_tag_relations')) {
          const relationStore = db.createObjectStore('flash_card_tag_relations', { keyPath: ['cardId', 'tagId'] });
          relationStore.createIndex('cardId', 'cardId', { unique: false });
          relationStore.createIndex('tagId', 'tagId', { unique: false });
        }
      };
    });
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  // Tab management methods
  async saveTab(tab: StoredTab): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['tabs'], 'readwrite');
      const store = transaction.objectStore('tabs');
      
      const request = store.put(tab);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async getTab(url: string): Promise<StoredTab | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['tabs'], 'readonly');
      const store = transaction.objectStore('tabs');
      
      const request = store.get(url);
      
      request.onsuccess = () => {
        const result = request.result as StoredTab;
        resolve(result || null);
      };
      
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async getAllTabs(): Promise<StoredTab[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['tabs'], 'readonly');
      const store = transaction.objectStore('tabs');
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result as StoredTab[]);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async deleteTab(url: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['tabs'], 'readwrite');
      const store = transaction.objectStore('tabs');
      
      const request = store.delete(url);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  // FlashCard tags methods
  async saveTag(tag: { name: string, color?: string }): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_card_tags'], 'readwrite');
      const store = transaction.objectStore('flash_card_tags');
      
      // Check if tag with this name already exists
      const nameIndex = store.index('name');
      const checkRequest = nameIndex.get(tag.name);
      
      checkRequest.onsuccess = () => {
        if (checkRequest.result) {
          // Tag already exists, return its ID
          resolve(checkRequest.result.id);
        } else {
          // Create new tag
          const addRequest = store.add(tag);
          
          addRequest.onsuccess = () => resolve(addRequest.result as number);
          addRequest.onerror = (event) => reject((event.target as IDBRequest).error);
        }
      };
      
      checkRequest.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async getAllTags(): Promise<FlashCardTag[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_card_tags'], 'readonly');
      const store = transaction.objectStore('flash_card_tags');
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result as FlashCardTag[]);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async deleteTag(id: number): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_card_tags'], 'readwrite');
      const store = transaction.objectStore('flash_card_tags');
      
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  // FlashCard management methods
  async saveFlashCard(flashCard: Omit<StoredFlashCard, 'id'> & { id?: number }): Promise<StoredFlashCard> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_cards'], 'readwrite');
      const store = transaction.objectStore('flash_cards');
      
      const cardToSave = {
        ...flashCard,
        createdAt: flashCard.createdAt || new Date().toISOString()
      };
      
      const request = flashCard.id ? store.put(cardToSave) : store.add(cardToSave);
      
      request.onsuccess = () => {
        const result = { ...cardToSave, id: request.result as number };
        resolve(result);
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async saveFlashCards(flashCards: FlashCard[]): Promise<FlashCard[]> {
    await this.ensureInitialized();
    
    const savedCards: FlashCard[] = [];
    
    for (const card of flashCards) {
      try {
        const savedCard = await this.saveFlashCard({
          question: card.question,
          answer: card.answer,
          sourceUrl: card.sourceUrl,
          sourceType: card.sourceType,
          sourceId: card.sourceId,
          createdAt: card.createdAt || new Date().toISOString()
        });
        
        // Add tags if present
        let tagsToAdd: FlashCardTag[] = [];
        if (card.tags && card.tags.length > 0) {
          tagsToAdd = await this.setFlashCardTags(savedCard.id!, card.tags.map(tag => tag.id!));
        }
        
        savedCards.push({
          ...savedCard,
          tags: tagsToAdd
        });
      } catch (error) {
        console.error('Failed to save flash card:', error);
      }
    }
    
    return savedCards;
  }

  async getFlashCard(id: number): Promise<FlashCard | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_cards'], 'readonly');
      const store = transaction.objectStore('flash_cards');
      
      const request = store.get(id);
      
      request.onsuccess = async () => {
        const result = request.result as StoredFlashCard;
        if (result) {
          const tags = await this.getFlashCardTags(result.id!);
          resolve({ ...result, tags });
        } else {
          resolve(null);
        }
      };
      
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async getAllFlashCards(): Promise<FlashCard[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_cards'], 'readonly');
      const store = transaction.objectStore('flash_cards');
      
      const request = store.getAll();
      
      request.onsuccess = async () => {
        const cards = request.result as StoredFlashCard[];
        const cardsWithTags = await Promise.all(
          cards.map(async (card) => {
            const tags = await this.getFlashCardTags(card.id!);
            return { ...card, tags };
          })
        );
        resolve(cardsWithTags);
      };
      
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async getFlashCardsBySource(sourceType: string, sourceId: string): Promise<FlashCard[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_cards'], 'readonly');
      const store = transaction.objectStore('flash_cards');
      const index = store.index('sourceTypeAndId');
      
      const request = index.getAll([sourceType, sourceId]);
      
      request.onsuccess = async () => {
        const cards = request.result as StoredFlashCard[];
        const cardsWithTags = await Promise.all(
          cards.map(async (card) => {
            const tags = await this.getFlashCardTags(card.id!);
            return { ...card, tags };
          })
        );
        resolve(cardsWithTags);
      };
      
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async deleteFlashCard(id: number): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_cards', 'flash_card_tag_relations'], 'readwrite');
      const cardStore = transaction.objectStore('flash_cards');
      const relationStore = transaction.objectStore('flash_card_tag_relations');
      
      // Delete the card
      const deleteCardRequest = cardStore.delete(id);
      
      // Delete related tag associations
      const relationIndex = relationStore.index('cardId');
      const getRelationsRequest = relationIndex.getAll(id);
      
      getRelationsRequest.onsuccess = () => {
        const relations = getRelationsRequest.result;
        relations.forEach(relation => {
          relationStore.delete([relation.cardId, relation.tagId]);
        });
      };
      
      deleteCardRequest.onsuccess = () => resolve(true);
      deleteCardRequest.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  // FlashCard-Tag relationship methods
  async getFlashCardTags(cardId: number): Promise<FlashCardTag[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_card_tag_relations', 'flash_card_tags'], 'readonly');
      const relationStore = transaction.objectStore('flash_card_tag_relations');
      const tagStore = transaction.objectStore('flash_card_tags');
      
      const relationIndex = relationStore.index('cardId');
      const request = relationIndex.getAll(cardId);
      
      request.onsuccess = async () => {
        const relations = request.result as FlashCardTagRelation[];
        const tags: FlashCardTag[] = [];
        
        for (const relation of relations) {
          const tagRequest = tagStore.get(relation.tagId);
          tagRequest.onsuccess = () => {
            if (tagRequest.result) {
              tags.push(tagRequest.result);
            }
            if (tags.length === relations.length) {
              resolve(tags);
            }
          };
        }
        
        if (relations.length === 0) {
          resolve([]);
        }
      };
      
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  async setFlashCardTags(cardId: number, tagIds: number[]): Promise<FlashCardTag[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction(['flash_card_tag_relations', 'flash_card_tags'], 'readwrite');
      const relationStore = transaction.objectStore('flash_card_tag_relations');
      const tagStore = transaction.objectStore('flash_card_tags');
      
      // First, remove existing relations for this card
      const relationIndex = relationStore.index('cardId');
      const getExistingRequest = relationIndex.getAll(cardId);
      
      getExistingRequest.onsuccess = () => {
        const existingRelations = getExistingRequest.result;
        
        // Delete existing relations
        existingRelations.forEach(relation => {
          relationStore.delete([relation.cardId, relation.tagId]);
        });
        
        // Add new relations
        const addPromises = tagIds.map(tagId => {
          return new Promise<void>((addResolve, addReject) => {
            const addRequest = relationStore.add({ cardId, tagId });
            addRequest.onsuccess = () => addResolve();
            addRequest.onerror = () => addReject(addRequest.error);
          });
        });
        
        Promise.all(addPromises).then(async () => {
          // Fetch and return the tags
          const tags: FlashCardTag[] = [];
          for (const tagId of tagIds) {
            const tagRequest = tagStore.get(tagId);
            tagRequest.onsuccess = () => {
              if (tagRequest.result) {
                tags.push(tagRequest.result);
              }
              if (tags.length === tagIds.length) {
                resolve(tags);
              }
            };
          }
          
          if (tagIds.length === 0) {
            resolve([]);
          }
        }).catch(reject);
      };
      
      getExistingRequest.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  // Export/Import functionality
  async exportFlashCards(): Promise<string> {
    await this.ensureInitialized();
    
    const [cards, tags] = await Promise.all([
      this.getAllFlashCards(),
      this.getAllTags()
    ]);
    
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      flashCards: cards,
      tags: tags
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importFlashCards(jsonData: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    await this.ensureInitialized();
    
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.flashCards || !Array.isArray(data.flashCards)) {
        throw new Error('Invalid import data: flashCards array not found');
      }
      
      const errors: string[] = [];
      let imported = 0;
      
      // Import tags first
      if (data.tags && Array.isArray(data.tags)) {
        for (const tag of data.tags) {
          try {
            await this.saveTag({ name: tag.name, color: tag.color });
          } catch (error) {
            // Tag might already exist, that's ok
          }
        }
      }
      
      // Import flash cards
      for (const card of data.flashCards) {
        try {
          if (!card.question || !card.answer || !card.sourceType || !card.sourceId) {
            errors.push(`Skipped invalid card: missing required fields`);
            continue;
          }
          
          const savedCard = await this.saveFlashCard({
            question: card.question,
            answer: card.answer,
            sourceUrl: card.sourceUrl,
            sourceType: card.sourceType,
            sourceId: card.sourceId,
            createdAt: card.createdAt || new Date().toISOString()
          });
          
          // Handle tags if present
          if (card.tags && Array.isArray(card.tags) && card.tags.length > 0) {
            const existingTags = await this.getAllTags();
            const tagIds: number[] = [];
            
            for (const cardTag of card.tags) {
              const existingTag = existingTags.find(t => t.name === cardTag.name);
              if (existingTag && existingTag.id) {
                tagIds.push(existingTag.id);
              }
            }
            
            if (tagIds.length > 0) {
              await this.setFlashCardTags(savedCard.id!, tagIds);
            }
          }
          
          imported++;
        } catch (error) {
          errors.push(`Failed to import card "${card.question}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return { success: true, imported, errors };
      
    } catch (error) {
      return { 
        success: false, 
        imported: 0, 
        errors: [`Failed to parse import data: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }
}

export const dbStorageService = new DBStorageService();
