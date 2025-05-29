import type { FlashCard, FlashCardTag } from '../types';
import { dbStorageService } from './dbStorageService';

class FlashCardService {
  async saveFlashCards(flashCards: FlashCard[]): Promise<FlashCard[]> {
    try {
      return await dbStorageService.saveFlashCards(flashCards);
    } catch (error) {
      console.error('Error saving flash cards:', error);
      throw new Error(`Failed to save flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFlashCardsBySource(sourceType: string, sourceId: string): Promise<FlashCard[]> {
    try {
      return await dbStorageService.getFlashCardsBySource(sourceType, sourceId);
    } catch (error) {
      console.error('Error fetching flash cards:', error);
      throw new Error(`Failed to fetch flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllFlashCards(): Promise<FlashCard[]> {
    try {
      return await dbStorageService.getAllFlashCards();
    } catch (error) {
      console.error('Error fetching all flash cards:', error);
      throw new Error(`Failed to fetch flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFlashCard(id: number): Promise<void> {
    try {
      await dbStorageService.deleteFlashCard(id);
    } catch (error) {
      console.error('Error deleting flash card:', error);
      throw new Error(`Failed to delete flash card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Tag related methods
  async getAllTags(): Promise<FlashCardTag[]> {
    try {
      return await dbStorageService.getAllTags();
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw new Error(`Failed to fetch tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async createTag(name: string, color?: string): Promise<FlashCardTag> {
    try {
      const tagId = await dbStorageService.saveTag({ name, color });
      return { id: tagId, name, color };
    } catch (error) {
      console.error('Error creating tag:', error);
      throw new Error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async deleteTag(id: number): Promise<void> {
    try {
      await dbStorageService.deleteTag(id);
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw new Error(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getFlashCardTags(cardId: number): Promise<FlashCardTag[]> {
    try {
      return await dbStorageService.getFlashCardTags(cardId);
    } catch (error) {
      console.error(`Error fetching tags for card ${cardId}:`, error);
      return []; // Return empty array on error instead of failing
    }
  }
  
  async setFlashCardTags(cardId: number, tagIds: number[]): Promise<FlashCardTag[]> {
    try {
      return await dbStorageService.setFlashCardTags(cardId, tagIds);
    } catch (error) {
      console.error(`Error setting tags for card ${cardId}:`, error);
      throw new Error(`Failed to set tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Export/Import methods
  async exportFlashCards(): Promise<string> {
    try {
      return await dbStorageService.exportFlashCards();
    } catch (error) {
      console.error('Error exporting flash cards:', error);
      throw new Error(`Failed to export flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importFlashCards(jsonData: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      return await dbStorageService.importFlashCards(jsonData);
    } catch (error) {
      console.error('Error importing flash cards:', error);
      throw new Error(`Failed to import flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const flashCardService = new FlashCardService();
