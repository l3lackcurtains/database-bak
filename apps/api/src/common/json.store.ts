import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

@Injectable()
export class JsonStore implements OnModuleInit {
  private data: Record<string, Record<string, any>> = {};

  onModuleInit() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    if (fs.existsSync(DB_PATH)) {
      try {
        this.data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      } catch {
        this.data = { databases: {}, storage: {}, snapshots: {}, jobs: {} };
      }
    } else {
      this.data = { databases: {}, storage: {}, snapshots: {}, jobs: {} };
    }
  }

  private save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
  }

  getAll<T>(collection: string): T[] {
    const store = this.data[collection] || {};
    return Object.values(store).sort((a: any, b: any) => {
      const aDate = a.createdAt || a.created_at || '';
      const bDate = b.createdAt || b.created_at || '';
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  getById<T>(collection: string, id: string): T | undefined {
    return this.data[collection]?.[id];
  }

  create<T extends { id: string }>(collection: string, item: T): T {
    if (!this.data[collection]) this.data[collection] = {};
    this.data[collection][item.id] = item;
    this.save();
    return item;
  }

  update<T extends { id: string }>(
    collection: string,
    id: string,
    updates: Partial<T>,
  ): T | null {
    if (!this.data[collection]?.[id]) return null;
    const existing = this.data[collection][id];
    this.data[collection][id] = { ...existing, ...updates, id };
    this.save();
    return this.data[collection][id];
  }

  delete(collection: string, id: string): boolean {
    if (!this.data[collection]?.[id]) return false;
    delete this.data[collection][id];
    this.save();
    return true;
  }

  count(collection: string): number {
    return Object.keys(this.data[collection] || {}).length;
  }

  findBy(collection: string, predicate: (item: any) => boolean): any[] {
    return this.getAll(collection).filter(predicate);
  }

  paginate<T>(collection: string, page: number = 1, limit: number = 20) {
    const all = this.getAll<T>(collection);
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    return { data, total, page, limit, totalPages };
  }
}
