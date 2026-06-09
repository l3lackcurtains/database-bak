import { BadRequestException, Injectable } from '@nestjs/common';
import { TursoStore } from '../common/turso.store';
import { CryptoService } from '../common/crypto.service';
import { DatabaseEntity } from '../entities/database.entity';
import { AuthUser } from '../auth/session';
import {
  CreateDatabaseDto,
  UpdateDatabaseDto,
  parseDatabaseUrl,
} from './database.types';

@Injectable()
export class DatabaseService {
  constructor(
    private store: TursoStore,
    private crypto: CryptoService,
  ) {}

  private decryptDb(db: DatabaseEntity): DatabaseEntity {
    return {
      ...db,
      password: this.crypto.decrypt(db.password || '') || db.password,
      url: db.url ? this.crypto.decrypt(db.url) || db.url : db.url,
    };
  }

  private encryptDb(db: Partial<DatabaseEntity>): Partial<DatabaseEntity> {
    return {
      ...db,
      password: db.password ? this.crypto.encrypt(db.password) : db.password,
      url: db.url ? this.crypto.encrypt(db.url) : db.url,
    };
  }

  async findAll(user?: AuthUser): Promise<DatabaseEntity[]> {
    const dbs = await this.store.getAll<DatabaseEntity>('databases');
    const filtered = dbs.filter((db: any) => {
      if (!user || user.role === 'admin') return true;
      return db.userId === user.id;
    });
    return filtered.map((db) => this.decryptDb(db));
  }

  async findOne(id: string, user?: AuthUser): Promise<DatabaseEntity | null> {
    const db = (await this.store.getById<DatabaseEntity>('databases', id)) || null;
    if (!db) return null;
    if (user && user.role !== 'admin' && db.userId !== user.id) {
      return null;
    }
    return this.decryptDb(db);
  }

  async create(dto: CreateDatabaseDto, user?: AuthUser): Promise<DatabaseEntity> {
    let data: Partial<DatabaseEntity & { userId?: string | null }>;

    if (dto.url) {
      const parsed = parseDatabaseUrl(dto.url);
      if (!parsed) throw new Error('Invalid connection URL');
      data = {
        id: '',
        name: dto.name || parsed.name || 'unnamed',
        label: dto.label,
        type: dto.type || parsed.type!,
        host: dto.host || parsed.host!,
        port: dto.port || parsed.port!,
        database: dto.database || parsed.database!,
        username: dto.username || parsed.username || '',
        password: dto.password || parsed.password,
        url: dto.url,
        ssl: dto.ssl ?? parsed.ssl ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user?.id || null,
      };
    } else {
      data = {
        id: '',
        name: dto.name!,
        label: dto.label,
        type: dto.type!,
        host: dto.host!,
        port: dto.port!,
        database: dto.database!,
        username: dto.username || '',
        password: dto.password,
        url: dto.url,
        ssl: dto.ssl ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user?.id || null,
      };
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity = { ...data, id } as DatabaseEntity;
    return this.store.create('databases', this.encryptDb(entity) as DatabaseEntity);
  }

  async update(
    id: string,
    dto: UpdateDatabaseDto,
    user?: AuthUser,
  ): Promise<DatabaseEntity | null> {
    const existing = await this.findOne(id, user);
    if (!existing) return null;
    const merged = { ...existing, ...dto, id, updatedAt: new Date().toISOString() };
    return this.store.create('databases', this.encryptDb(merged) as DatabaseEntity);
  }

  async remove(id: string, user?: AuthUser): Promise<void> {
    const existing = await this.findOne(id, user);
    if (!existing) {
      throw new BadRequestException('Database not found or unauthorized');
    }
    const jobs = await this.store.findBy('jobs', (job: { databaseId?: string }) => job.databaseId === id);
    if (jobs.length > 0) {
      throw new BadRequestException('Cannot delete database while jobs reference it');
    }
    await this.store.delete('databases', id);
  }

  async testConnection(
    dto: CreateDatabaseDto,
  ): Promise<{ success: boolean; message: string }> {
    let config: {
      type: string;
      host: string;
      port: number;
      database: string;
      username: string;
      password?: string;
      ssl?: boolean;
    };

    if (dto.url) {
      const parsed = parseDatabaseUrl(dto.url);
      if (!parsed) return { success: false, message: 'Invalid connection URL' };
      config = {
        type: parsed.type!,
        host: parsed.host!,
        port: parsed.port!,
        database: parsed.database!,
        username: parsed.username || '',
        password: parsed.password,
        ssl: parsed.ssl,
      };
    } else {
      config = {
        type: dto.type!,
        host: dto.host!,
        port: dto.port!,
        database: dto.database!,
        username: dto.username || '',
        password: dto.password,
        ssl: dto.ssl,
      };
    }

    try {
      if (config.type === 'postgres') {
        const { Client } = await import('pg').catch(() => ({ Client: null }));
        if (!Client) {
          return {
            success: false,
            message: 'pg driver not installed. Run: bun add pg',
          };
        }
        const clientOptions = dto.url
          ? {
              connectionString: dto.url,
              ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
              connectionTimeoutMillis: 5000,
            }
          : {
              host: config.host,
              port: config.port,
              database: config.database,
              user: config.username,
              password: config.password,
              ssl: config.ssl ? { rejectUnauthorized: false } : false,
              connectionTimeoutMillis: 5000,
            };
        const client = new Client(clientOptions);
        await client.connect();
        await client.end();
        return {
          success: true,
          message: `Connected to PostgreSQL at ${config.host}:${config.port}`,
        };
      } else if (config.type === 'mongodb') {
        const { MongoClient } = await import('mongodb').catch(() => ({
          MongoClient: null,
        }));
        if (!MongoClient) {
          return {
            success: false,
            message: 'mongodb driver not installed. Run: bun add mongodb',
          };
        }
        if (dto.url) {
          const client = new MongoClient(dto.url, {
            serverSelectionTimeoutMS: 5000,
          });
          await client.connect();
          await client.close();
          return { success: true, message: `Connected to MongoDB` };
        }
        const auth = config.username
          ? `${config.username}${config.password ? `:${config.password}` : ''}@`
          : '';
        const uri = `mongodb://${auth}${config.host}:${config.port}/${config.database}`;
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        await client.close();
        return {
          success: true,
          message: `Connected to MongoDB at ${config.host}:${config.port}`,
        };
      }
      return { success: false, message: 'Unsupported database type' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection failed' };
    }
  }
}
