import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect } from '@tursodatabase/serverless';
import * as bcrypt from 'bcryptjs';
import { setAuthConfiguredViaDb } from './auth-config';


const SCHEMAS = [
  `CREATE TABLE IF NOT EXISTS databases (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    host TEXT NOT NULL, port INTEGER NOT NULL, database TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT '', password TEXT NOT NULL DEFAULT '',
    ssl INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, url TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS storage (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL,
    endpoint TEXT NOT NULL, region TEXT NOT NULL DEFAULT 'us-east-1',
    bucket TEXT NOT NULL, accessKeyId TEXT NOT NULL, secretAccessKey TEXT NOT NULL,
    pathPrefix TEXT NOT NULL DEFAULT 'backups/', isDefault INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'disconnected', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY, databaseId TEXT NOT NULL, databaseName TEXT NOT NULL,
    databaseType TEXT NOT NULL, storageId TEXT NOT NULL,
    sourceType TEXT, sourceJobId TEXT, sourceJobName TEXT,
    storageKey TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
    compressedSize INTEGER NOT NULL DEFAULT 0, checksum TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', startedAt TEXT NOT NULL,
    completedAt TEXT, error TEXT, metadata TEXT, createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, databaseId TEXT NOT NULL,
    databaseName TEXT NOT NULL, storageId TEXT NOT NULL, type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', schedule TEXT,
    options TEXT NOT NULL DEFAULT '{}', runCount INTEGER NOT NULL DEFAULT 0,
    failedRunCount INTEGER NOT NULL DEFAULT 0, progress INTEGER NOT NULL DEFAULT 0,
    currentStep TEXT NOT NULL DEFAULT '', snapshotId TEXT, error TEXT,
    startedAt TEXT, completedAt TEXT, createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL, details TEXT
  )`,
];

const MIGRATIONS = [
  'ALTER TABLE databases ADD COLUMN label TEXT DEFAULT NULL',
  'ALTER TABLE storage ADD COLUMN label TEXT DEFAULT NULL',
];

const TABLE = { databases: 'databases', storage: 'storage', snapshots: 'snapshots', jobs: 'jobs', users: 'users' } as const;

type Row = Record<string, any>;

function fromRow(row: Record<string, any>): any {
  const obj: any = { ...row };
  for (const key of ['schedule', 'options', 'details', 'metadata']) {
    if (typeof obj[key] === 'string') {
      try { obj[key] = JSON.parse(obj[key]); } catch { obj[key] = null; }
    }
  }
  if (typeof obj.ssl === 'number') obj.ssl = obj.ssl === 1;
  if (typeof obj.isDefault === 'number') obj.isDefault = obj.isDefault === 1;
  return obj;
}

const DROP_COLS = new Set(['status', 'lastCheckedAt']);

function toRow(item: any, collection: string): Record<string, any> {
  const row: Record<string, any> = {};
  for (const [key, val] of Object.entries(item)) {
    if (val === undefined) continue;
    if (key === 'ssl' || key === 'isDefault') { row[key] = val ? 1 : 0; continue; }
    if (key === 'schedule' || key === 'options' || key === 'details' || key === 'metadata') {
      row[key] = val ? JSON.stringify(val) : null; continue;
    }
    row[key] = val;
  }
  if (collection === 'databases') {
    for (const col of DROP_COLS) delete row[col];
  }
  return row;
}

function cols(row: Record<string, any>): string[] {
  return Object.keys(row);
}

function vals(row: Record<string, any>): any[] {
  return Object.values(row);
}

function updateSet(row: Record<string, any>): string {
  return Object.keys(row).map((k) => `${k} = ?`).join(', ');
}

type QueryResult = {
  rows: any[];
  columns: string[];
  rowsAffected: number;
};

interface DbClient {
  execute(sql: string, params?: any[]): Promise<QueryResult>;
  close(): void;
}

class TursoClient implements DbClient {
  constructor(private client: ReturnType<typeof connect>) {}

  execute(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.client.execute(sql, params).then((result: any) => ({
      rows: result.rows || [],
      columns: result.columns || [],
      rowsAffected: result.rowsAffected || 0,
    }));
  }

  close() {
    this.client.close();
  }
}

@Injectable()
export class TursoStore implements OnModuleInit, OnModuleDestroy {
  private client!: DbClient;

  constructor() {
    const url = process.env.TURSO_DB_URL || '';
    const authToken = process.env.TURSO_AUTH_TOKEN || '';

    if (!url) {
      throw new Error('TURSO_DB_URL environment variable is required');
    }

    this.client = new TursoClient(connect({ url, authToken }));
  }

  async onModuleInit() {
    for (const sql of SCHEMAS) {
      await this.client.execute(sql);
    }
    for (const stmt of MIGRATIONS) {
      try { await this.client.execute(stmt); } catch {}
    }
    await this.seedLabels();
    await this.seedAdminUser();
  }

  private async seedLabels() {
    for (const table of ['databases', 'storage']) {
      try { await this.client.execute(`UPDATE ${table} SET label = name WHERE label IS NULL`); } catch {}
    }
  }

  private async seedAdminUser() {
    const rs = await this.client.execute('SELECT COUNT(*) as cnt FROM users');
    const userCount = Number((rs.rows[0] as any[])[0]);

    if (userCount > 0) {
      setAuthConfiguredViaDb(true);
      return;
    }

    const username = process.env.DASHBOARD_USERNAME;
    const password = process.env.DASHBOARD_PASSWORD;
    if (!username || !password) return;

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await this.client.execute(
      'INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, passwordHash, 'admin', now, now],
    );
    setAuthConfiguredViaDb(true);
  }

  async onModuleDestroy() {
    this.client.close();
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const table = (TABLE as any)[collection];
    const rs = await this.client.execute(`SELECT * FROM ${table} ORDER BY createdAt DESC`);
    return rs.rows.map((r: any) => {
      const obj: any = {};
      for (let i = 0; i < rs.columns.length; i++) obj[rs.columns[i]] = (r as any[])[i];
      return fromRow(obj) as T;
    });
  }

  async getById<T>(collection: string, id: string): Promise<T | undefined> {
    const table = (TABLE as any)[collection];
    const rs = await this.client.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (rs.rows.length === 0) return undefined;
    const obj: any = {};
    for (let i = 0; i < rs.columns.length; i++) obj[rs.columns[i]] = (rs.rows[0] as any[])[i];
    return fromRow(obj) as T;
  }

  async create<T extends { id: string }>(collection: string, item: T): Promise<T> {
    const table = (TABLE as any)[collection];
    const row = toRow(item, collection);
    const now = new Date().toISOString();
    row.createdAt = row.createdAt || now;
    if (collection !== 'snapshots') {
      row.updatedAt = row.updatedAt || now;
    }
    const c = cols(row);
    const placeholders = c.map(() => '?').join(', ');
    await this.client.execute(
      `INSERT OR REPLACE INTO ${table} (${c.join(', ')}) VALUES (${placeholders})`,
      vals(row),
    );
    return item;
  }

  async update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): Promise<T | null> {
    const existing = await this.getById<any>(collection, id);
    if (!existing) return null;

    const merged = { ...existing, ...updates, id };
    const now = new Date().toISOString();
    
    // Only set updatedAt if the table actually has that column (snapshots does not)
    if (collection !== 'snapshots') {
      merged.updatedAt = now;
    }

    const row = toRow(merged, collection);
    delete row.id;
    delete row.createdAt;

    await this.client.execute(
      `UPDATE ${(TABLE as any)[collection]} SET ${updateSet(row)} WHERE id = ?`,
      [...vals(row), id],
    );
    return merged as T;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const table = (TABLE as any)[collection];
    const rs = await this.client.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return rs.rowsAffected > 0;
  }

  async count(collection: string): Promise<number> {
    const table = (TABLE as any)[collection];
    const rs = await this.client.execute(`SELECT COUNT(*) as cnt FROM ${table}`);
    return Number((rs.rows[0] as any[])[0]);
  }

  async findByUsername(username: string): Promise<{ id: string; username: string; passwordHash: string; role: string; createdAt: string; updatedAt: string } | undefined> {
    const rs = await this.client.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rs.rows.length === 0) return undefined;
    const obj: any = {};
    for (let i = 0; i < rs.columns.length; i++) obj[rs.columns[i]] = (rs.rows[0] as any[])[i];
    return fromRow(obj);
  }

  async findBy(collection: string, predicate: (item: any) => boolean): Promise<any[]> {
    const all = await this.getAll(collection);
    return all.filter(predicate);
  }

  async paginate<T>(collection: string, page: number = 1, limit: number = 20) {
    const table = (TABLE as any)[collection];
    const offset = (page - 1) * limit;
    const [countRs, dataRs] = await Promise.all([
      this.client.execute(`SELECT COUNT(*) as cnt FROM ${table}`),
      this.client.execute(`SELECT * FROM ${table} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [limit, offset]),
    ]);
    const total = Number((countRs.rows[0] as any[])[0]);
    const data = dataRs.rows.map((r: any) => {
      const obj: any = {};
      for (let i = 0; i < dataRs.columns.length; i++) obj[dataRs.columns[i]] = (r as any[])[i];
      return fromRow(obj) as T;
    });
    const totalPages = Math.ceil(total / limit);
    return { data, total, page, limit, totalPages };
  }
}
