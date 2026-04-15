/**
 * @file In-Memory Repository
 * @description Test double for repository - no real database
 */

export class InMemoryRepo<T extends { id?: string }> {
  private data: Map<string, T> = new Map();

  constructor(initialData: Record<string, T> = {}) {
    Object.entries(initialData).forEach(([key, value]) => {
      this.data.set(key, value);
    });
  }

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) || null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async create(item: T): Promise<T> {
    const id = item.id || `id-${Date.now()}`;
    const newItem = { ...item, id };
    this.data.set(id, newItem);
    return newItem;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.data.get(id);
    if (!existing) {
      throw new Error(`Item with id ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }

  // Test helper methods
  clear(): void {
    this.data.clear();
  }

  get size(): number {
    return this.data.size;
  }
}

