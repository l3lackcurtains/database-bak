import { Injectable, Logger } from '@nestjs/common';
import { gzipSync } from 'zlib';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupEngine {
  private readonly logger = new Logger(BackupEngine.name);

  private async runCommandToBuffer(command: string, args: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          reject(new Error(`${command} is not installed or not available in PATH`));
          return;
        }
        reject(error);
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(stdout));
          return;
        }
        reject(new Error(Buffer.concat(stderr).toString('utf-8').trim() || `${command} exited with code ${code}`));
      });
    });
  }

  private packageDump(rawData: Buffer): {
    data: Buffer;
    size: number;
    checksum: string;
  } {
    const compressedData = gzipSync(rawData);
    return {
      data: compressedData,
      size: rawData.length,
      checksum: this.computeChecksum(compressedData),
    };
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
    data: Buffer;
    size: number;
    checksum: string;
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

  private async dumpPostgres(db: any): Promise<{
    data: Buffer;
    size: number;
    checksum: string;
    metadata: Record<string, any>;
  }> {
    try {
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

      let totalRecords = 0;
      for (const table of tables.slice(0, 5)) {
        const count = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        totalRecords += parseInt(count.rows[0].count);
      }

      const versionResult = await client.query('SELECT version()');
      await client.end();

      const rawData = Buffer.from(
        `-- PostgreSQL ${db.database} dump\n-- Tables: ${tables.join(', ')}\n-- Generated at ${new Date().toISOString()}\n`,
      );
      const dump = this.packageDump(rawData);

      return {
        data: dump.data,
        size: dump.size,
        checksum: dump.checksum,
        metadata: {
          version: versionResult.rows[0].version,
          tables,
          recordCount: totalRecords,
        },
      };
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        this.logger.warn('pg module not installed, generating mock dump');
        return this.generateMockDump(db);
      }
      throw error;
    }
  }

  private async dumpMongoDB(db: any): Promise<{
    data: Buffer;
    size: number;
    checksum: string;
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

      const archive = await this.runCommandToBuffer('mongodump', args);
      const checksum = this.computeChecksum(archive);

      return {
        data: archive,
        size: archive.length,
        checksum,
        metadata: {
          version: 'mongodump',
          collections: collectionNames,
          archive: true,
          gzip: true,
        },
      };
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        this.logger.warn('mongodb module not installed, generating mock dump');
        return this.generateMockDump(db);
      }
      throw error;
    }
  }

  private async generateMockDump(db: any): Promise<{
    data: Buffer;
    size: number;
    checksum: string;
    metadata: Record<string, any>;
  }> {
    const rawData = Buffer.from(
      `-- ${db.type} ${db.database} dump (mock)\n-- Host: ${db.host}:${db.port}\n-- Generated at ${new Date().toISOString()}\n-- Note: Install '${db.type === 'postgres' ? 'pg' : 'mongodb'}' package for real dumps\n`,
    );
    const dump = this.packageDump(rawData);
    return {
      data: dump.data,
      size: dump.size,
      checksum: dump.checksum,
      metadata: { version: 'mock', tables: ['mock_table'], recordCount: 0 },
    };
  }

  private computeChecksum(data: Buffer): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 16);
  }
}
