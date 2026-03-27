export type MemoryListType = 'reductive' | 'reinforcing';

const STORAGE_KEYS: Record<MemoryListType, string> = {
  reductive: 'gempest_memory_list',
  reinforcing: 'gempest_reinforcing_memory_list',
};

class MemoryService {
  private load(type: MemoryListType): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS[type]);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private save(list: string[], type: MemoryListType): void {
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(list));
  }

  getMemoryList(type: MemoryListType = 'reductive'): string[] {
    return this.load(type);
  }

  addMemoryItem(phrase: string, type: MemoryListType = 'reductive'): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    const list = this.load(type);
    const alreadyExists = list.some(
      (item) => item.toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadyExists) return;

    list.push(trimmed);
    this.save(list, type);
    console.log(`[memoryService] Added item: "${trimmed}"`);
  }

  removeMemoryItem(index: number, type: MemoryListType = 'reductive'): void {
    const list = this.load(type);
    if (index < 0 || index >= list.length) return;

    const [removed] = list.splice(index, 1);
    this.save(list, type);
    console.log(`[memoryService] Removed item at index ${index}: "${removed}"`);
  }

  updateMemoryItem(index: number, newPhrase: string, type: MemoryListType = 'reductive'): void {
    const trimmed = newPhrase.trim();
    const list = this.load(type);
    if (index < 0 || index >= list.length || !trimmed) return;

    const old = list[index];
    list[index] = trimmed;
    this.save(list, type);
    console.log(`[memoryService] Updated item at index ${index}: "${old}" → "${trimmed}"`);
  }

  clearAll(type: MemoryListType = 'reductive'): void {
    this.save([], type);
    console.log('[memoryService] Cleared all memory items.');
  }

  getFormattedList(type: MemoryListType = 'reductive'): string {
    const list = this.load(type);
    if (list.length === 0) return '';

    return list.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }
}

export const memoryService = new MemoryService();
