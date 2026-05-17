import { Injectable } from '@nestjs/common';

@Injectable()
export class InMemoryStore {
  private stores = new Map<string, Map<string, any>>();

  constructor() {
    ['databases', 'storage', 'snapshots', 'jobs'].forEach((name) => {
      this.stores.set(name, new Map());
    });
  }

  getAll<T>(collection: string): T[] {
    return Array.from(this.stores.get(collection)?.values() || []);
  }

  getById<T>(collection: string, id: string): T | undefined {
    return this.stores.get(collection)?.get(id);
  }

  create<T extends { id: string }>(collection: string, item: T): T {
    this.stores.get(collection)?.set(item.id, item);
    return item;
  }

  update<T extends { id: string }>(
    collection: string,
    id: string,
    updates: Partial<T>,
  ): T | null {
    const store = this.stores.get(collection);
    if (!store || !store.has(id)) return null;
    const existing = store.get(id);
    const updated = { ...existing, ...updates, id };
    store.set(id, updated);
    return updated;
  }

  delete(collection: string, id: string): boolean {
    return this.stores.get(collection)?.delete(id) || false;
  }

  count(collection: string): number {
    return this.stores.get(collection)?.size || 0;
  }

  findBy(collection: string, predicate: (item: any) => boolean): any[] {
    return this.getAll(collection).filter(predicate);
  }

  paginate<T>(
    collection: string,
    page: number = 1,
    limit: number = 20,
  ): {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const all = this.getAll<T>(collection);
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return { data, total, page, limit, totalPages };
  }
}
