import { Injectable, Logger } from '@nestjs/common';
import { gzipSync } from 'zlib';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Readable, Transform, PassThrough } from 'stream';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

@Injectable()
export class BackupEngine {
  private readonly logger = new Logger(BackupEngine.name);

  private runCommandToStream(command: string, args: string[]): Readable {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stderr: Buffer[] = [];

    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    
    child.on('error', (error: NodeJS.ErrnoException) => {
      this.logger.error(`Command ${command} failed to start:`, error);
      child.stdout.destroy(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const errorMsg = Buffer.concat(stderr).toString('utf-8').trim() || `${command} exited with code ${code}`;
        this.logger.error(`Command ${command} failed: ${errorMsg}`);
        child.stdout.destroy(new Error(errorMsg));
      }
    });

    return child.stdout;
  }

  private async runCommandWithStreamInput(command: string, args: string[], inputStream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] });
      const stderr: Buffer[] = [];

      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      
      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(error);
      });
      
      child.on('close', (code) => {
        const stderrText = Buffer.concat(stderr).toString('utf-8').trim();
        if (code === 0) {
          resolve(stderrText);
          return;
        }
        reject(new Error(stderrText || `${command} exited with code ${code}`));
      });

      inputStream.pipe(child.stdin);
    });
  }

  private mongoUriWithoutDatabase(uri: string, authDatabase?: string): string {
    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/);
    if (!match) return uri;

    const base = match[1];
    const query = new URLSearchParams((match[3] || '').replace(/^\?/, ''));
    if (authDatabase && !query.has('authSource')) {
      query.set('authSource', authDatabase);
    }
    const queryString = query.toString();
    return `${base}/${queryString ? `?${queryString}` : ''}`;
  }

  async dumpDatabase(db: {
    type: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
    url?: string;
    ssl?: boolean;
  }): Promise<{
    stream: Readable;
    metadata: Record<string, any>;
  }> {
    this.logger.log(`Dumping ${db.type} database: ${db.database}`);

    if (db.type === 'postgres') {
      return this.dumpPostgres(db);
    } else if (db.type === 'mongodb') {
      return this.dumpMongoDB(db);
    }

    throw new Error(`Unsupported database type: ${db.type}`);
  }

  async restoreDatabase(
    db: {
      type: string;
      host: string;
      port: number;
      database: string;
      username: string;
      password?: string;
      url?: string;
      ssl?: boolean;
    },
    snapshot: {
      databaseType: string;
      metadata?: Record<string, any> | null;
    },
    archiveStream: Readable,
    options: { cleanBeforeRestore?: boolean } = {},
  ): Promise<void> {
    if (db.type !== snapshot.databaseType) {
      throw new Error(`Cannot restore ${snapshot.databaseType} snapshot into ${db.type} database`);
    }

    if (db.type === 'mongodb') {
      await this.restoreMongoDB(db, snapshot, archiveStream, options);
      return;
    }

    if (db.type === 'postgres') {
      await this.restorePostgres(db, snapshot, archiveStream, options);
      return;
    }

    throw new Error(`Restore is not implemented for ${db.type} yet`);
  }

  private async dumpPostgres(db: any): Promise<{
    stream: Readable;
    metadata: Record<string, any>;
  }> {
    const { Client } = await import('pg');
    const client = new Client(
      db.url
        ? {
            connectionString: db.url,
            ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
            connectionTimeoutMillis: 10000,
          }
        : {
            host: db.host,
            port: db.port,
            database: db.database,
            user: db.username,
            password: db.password,
            ssl: db.ssl ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,
          },
    );
    await client.connect();

    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tables = tablesResult.rows.map((r: any) => r.table_name);
    const versionResult = await client.query('SELECT version()');
    await client.end();

    const uri = db.url || `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`;
    // Use custom format (-F c) which pg_restore can read natively and is compressed by default
    const args = ['--dbname', uri, '-F', 'c'];
    const stream = this.runCommandToStream('pg_dump', args);

    return {
      stream,
      metadata: {
        version: versionResult.rows[0].version,
        tables,
        format: 'custom',
        archive: true
      },
    };
  }

  private async restorePostgres(
    db: any,
    snapshot: { metadata?: Record<string, any> | null },
    archiveStream: Readable,
    options: { cleanBeforeRestore?: boolean },
  ): Promise<void> {
    const uri = db.url || `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`;
    
    // pg_restore reads custom format
    const args = ['--dbname', uri, '-d', db.database];
    if (options.cleanBeforeRestore) {
      args.push('--clean', '--if-exists');
    }

    await this.runCommandWithStreamInput('pg_restore', args, archiveStream);
  }

  private async dumpMongoDB(db: any): Promise<{
    stream: Readable;
    metadata: Record<string, any>;
  }> {
    try {
      const { MongoClient } = await import('mongodb');
      const auth = db.username
        ? `${db.username}${db.password ? `:${db.password}` : ''}@`
        : '';
      const uri = db.url || `mongodb://${auth}${db.host}:${db.port}/${db.database}`;
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();

      const dbInstance = client.db(db.database);
      const collections = await dbInstance.listCollections().toArray();
      const collectionNames = collections.map((c: any) => c.name);
      await client.close();

      const args = ['--uri', uri, '--archive', '--gzip'];
      const parsedUri = new URL(uri.replace(/^mongodb\+srv:\/\//, 'mongodb://'));
      const uriDatabase = parsedUri.pathname.replace(/^\/+/, '');
      if (!uriDatabase && db.database) {
        args.push('--db', db.database);
      }

      const archiveStream = this.runCommandToStream('mongodump', args);

      return {
        stream: archiveStream,
        metadata: {
          version: 'mongodump',
          database: db.database,
          collections: collectionNames,
          archive: true,
          gzip: true,
        },
      };
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        this.logger.warn('mongodb module not installed, generating mock stream');
        return this.generateMockStream(db);
      }
      throw error;
    }
  }

  private async restoreMongoDB(
    db: any,
    snapshot: { metadata?: Record<string, any> | null },
    archiveStream: Readable,
    options: { cleanBeforeRestore?: boolean },
  ): Promise<void> {
    const auth = db.username
      ? `${db.username}${db.password ? `:${db.password}` : ''}@`
      : '';
    const uri = db.url || `mongodb://${auth}${db.host}:${db.port}/${db.database}`;
    
    // Explicitly clean the target database before restoring if requested
    if (options.cleanBeforeRestore && db.database) {
      this.logger.log(`Cleaning target database ${db.database} before restore`);
      const { MongoClient } = await import('mongodb');
      const cleanClient = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
      try {
        await cleanClient.connect();
        await cleanClient.db(db.database).dropDatabase();
        this.logger.log(`Dropped target database ${db.database} successfully`);
      } catch (err: any) {
        this.logger.warn(`Failed to drop target database ${db.database}: ${err.message}`);
      } finally {
        await cleanClient.close();
      }
    }

    const args = ['--uri', uri, '--archive', '--gzip'];

    const sourceDatabase = snapshot.metadata?.database;
    if (sourceDatabase && db.database && sourceDatabase !== db.database) {
      args[1] = this.mongoUriWithoutDatabase(uri, db.username ? db.database : undefined);
      args.push('--nsFrom', `${sourceDatabase}.*`, '--nsTo', `${db.database}.*`);
    }

    const output = await this.runCommandWithStreamInput('mongorestore', args, archiveStream);
    const expectedCollections = snapshot.metadata?.collections;
    if (Array.isArray(expectedCollections) && expectedCollections.length > 0) {
      const restoredMatch = output.match(/(\d+)\s+document\(s\) restored successfully/i);
      if (restoredMatch && Number(restoredMatch[1]) === 0) {
        throw new Error(`mongorestore completed but restored 0 documents into ${db.database}`);
      }

      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      const restoredCollections = await client.db(db.database).listCollections().toArray();
      await client.close();
      if (restoredCollections.length === 0) {
        throw new Error(`Restore completed but ${db.database} has no collections. Check the target MongoDB host and namespace mapping.`);
      }
    }
  }

  private async generateMockStream(db: any): Promise<{
    stream: Readable;
    metadata: Record<string, any>;
  }> {
    const rawData = Buffer.from(
      `-- ${db.type} ${db.database} dump (mock)\n-- Host: ${db.host}:${db.port}\n-- Generated at ${new Date().toISOString()}\n-- Note: Install '${db.type === 'postgres' ? 'pg' : 'mongodb'}' package for real dumps\n`,
    );
    const compressedData = gzipSync(rawData);
    const stream = new Readable();
    stream.push(compressedData);
    stream.push(null);
    return {
      stream,
      metadata: { version: 'mock', tables: ['mock_table'], recordCount: 0 },
    };
  }
}
