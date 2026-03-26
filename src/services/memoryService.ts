const STORAGE_KEY = 'gempest_memory_list';

class MemoryService {
  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private save(list: string[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  getMemoryList(): string[] {
    return this.load();
  }

  addMemoryItem(phrase: string): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    const list = this.load();
    const alreadyExists = list.some(
      (item) => item.toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadyExists) return;

    list.push(trimmed);
    this.save(list);
    console.log(`[memoryService] Added item: "${trimmed}"`);
  }

  removeMemoryItem(index: number): void {
    const list = this.load();
    if (index < 0 || index >= list.length) return;

    const [removed] = list.splice(index, 1);
    this.save(list);
    console.log(`[memoryService] Removed item at index ${index}: "${removed}"`);
  }

  updateMemoryItem(index: number, newPhrase: string): void {
    const trimmed = newPhrase.trim();
    const list = this.load();
    if (index < 0 || index >= list.length || !trimmed) return;

    const old = list[index];
    list[index] = trimmed;
    this.save(list);
    console.log(`[memoryService] Updated item at index ${index}: "${old}" → "${trimmed}"`);
  }

  clearAll(): void {
    this.save([]);
    console.log('[memoryService] Cleared all memory items.');
  }

  getFormattedList(): string {
    const list = this.load();
    if (list.length === 0) return '';

    return list.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }
}

export const memoryService = new MemoryService();
