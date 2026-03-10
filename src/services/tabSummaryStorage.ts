import type { LinkSummary } from "../types";

// Link summaries persistent storage service
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

class TabSummaryStorageService {
  private readonly DB_NAME = 'gmail-reader-tabs-db';
  private readonly DB_VERSION = 4; // Incremented to fix version conflict
  private readonly TABS_STORE = 'tabs';
  private db: IDBDatabase | null = null;
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
        const error = (event.target as IDBRequest).error;
        console.error("Database error:", error);
        
        // Handle version error by clearing the database and retrying
        if (error?.name === 'VersionError') {
          console.warn('Database version conflict detected. Clearing database...');
          const deleteRequest = indexedDB.deleteDatabase(this.DB_NAME);
          deleteRequest.onsuccess = () => {
            console.log('Database cleared. Retrying initialization...');
            // Retry initialization after clearing
            const retryRequest = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            retryRequest.onsuccess = (retryEvent) => {
              this.db = (retryEvent.target as IDBOpenDBRequest).result;
              this.initialized = true;
              resolve(true);
            };
            retryRequest.onerror = () => {
              reject(new Error('Failed to initialize database after clearing'));
            };
            retryRequest.onupgradeneeded = this.handleUpgrade.bind(this);
          };
          deleteRequest.onerror = () => {
            reject(new Error('Failed to clear conflicting database'));
          };
        } else {
          reject(error);
        }
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.initialized = true;
        resolve(true);
      };
      
      request.onupgradeneeded = this.handleUpgrade.bind(this);
    });
  }

  private handleUpgrade(event: IDBVersionChangeEvent) {
    const db = (event.target as IDBOpenDBRequest).result;
    
    // Create tabs store
    if (!db.objectStoreNames.contains(this.TABS_STORE)) {
      const tabStore = db.createObjectStore(this.TABS_STORE, { keyPath: 'url' });
      tabStore.createIndex('lastOpened', 'lastOpened', { unique: false });
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  async saveTab(tab: StoredTab): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction([this.TABS_STORE], 'readwrite');
      const store = transaction.objectStore(this.TABS_STORE);
      
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
      
      const transaction = this.db.transaction([this.TABS_STORE], 'readonly');
      const store = transaction.objectStore(this.TABS_STORE);
      
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
      
      const transaction = this.db.transaction([this.TABS_STORE], 'readonly');
      const store = transaction.objectStore(this.TABS_STORE);
      
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
      
      const transaction = this.db.transaction([this.TABS_STORE], 'readwrite');
      const store = transaction.objectStore(this.TABS_STORE);
      
      const request = store.delete(url);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  // Convert LinkSummary to StoredTab and save
  async saveLinkSummary(url: string, linkSummary: LinkSummary, content?: string, title?: string): Promise<void> {
    const tab: StoredTab = {
      url,
      title: title || '',
      content: content || '',
      summary: linkSummary.summary || '',
      error: linkSummary.error,
      lastOpened: Date.now(),
      summaryRequested: true,
      summaryReady: !linkSummary.loading
    };
    
    await this.saveTab(tab);
  }
  
  // Convert StoredTab to LinkSummary
  toLinkSummary(tab: StoredTab): LinkSummary {
    return {
      url: tab.url,
      finalUrl: tab.url, // reuse same URL as we don't store finalUrl separately
      summary: tab.summary || '',
      error: tab.error,
      loading: !tab.summaryReady
    };
  }
}

export const tabSummaryStorage = new TabSummaryStorageService();
