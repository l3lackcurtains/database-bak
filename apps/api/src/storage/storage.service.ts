import { BadRequestException, Injectable } from '@nestjs/common';
import { TursoStore } from '../common/turso.store';
import { CryptoService } from '../common/crypto.service';
import { AuthUser } from '../auth/session';
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { StorageEntity } from '../entities/storage.entity';
import { CreateStorageDto, UpdateStorageDto } from './storage.types';

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint) return endpoint;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `https://${endpoint}`;
}

@Injectable()
export class StorageService {
  constructor(
    private store: TursoStore,
    private crypto: CryptoService,
  ) {}

  private decryptStorage(s: StorageEntity): StorageEntity {
    return {
      ...s,
      accessKeyId: this.crypto.decrypt(s.accessKeyId) || s.accessKeyId,
      secretAccessKey: this.crypto.decrypt(s.secretAccessKey) || s.secretAccessKey,
    };
  }

  private encryptStorage(s: Partial<StorageEntity>): Partial<StorageEntity> {
    return {
      ...s,
      accessKeyId: s.accessKeyId ? this.crypto.encrypt(s.accessKeyId) : s.accessKeyId,
      secretAccessKey: s.secretAccessKey ? this.crypto.encrypt(s.secretAccessKey) : s.secretAccessKey,
    };
  }

  async findAll(user?: AuthUser): Promise<StorageEntity[]> {
    const list = await this.store.getAll<StorageEntity>('storage');
    const filtered = list.filter((s: any) => {
      if (!user || user.role === 'admin') return true;
      return s.userId === user.id || !s.userId;
    });
    return filtered.map((s) => this.decryptStorage(s));
  }

  async findOne(id: string, user?: AuthUser): Promise<StorageEntity | null> {
    const s = (await this.store.getById<StorageEntity>('storage', id)) || null;
    if (!s) return null;
    if (user && user.role !== 'admin' && s.userId && s.userId !== user.id) {
      return null;
    }
    return this.decryptStorage(s);
  }

  async getDefault(user?: AuthUser): Promise<StorageEntity | null> {
    const found = await this.store.findBy('storage', (s: any) => s.isDefault);
    const filtered = found.filter((s: any) => {
      if (!user || user.role === 'admin') return true;
      return s.userId === user.id || !s.userId;
    });
    return filtered[0] || null;
  }

  async create(dto: CreateStorageDto, user?: AuthUser): Promise<StorageEntity> {
    const count = await this.store.count('storage');
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity: StorageEntity & { userId?: string | null } = {
      id,
      name: dto.name,
      label: dto.label,
      provider: dto.provider,
      endpoint: dto.endpoint,
      region: dto.region || 'us-east-1',
      bucket: dto.bucket,
      accessKeyId: dto.accessKeyId,
      secretAccessKey: dto.secretAccessKey,
      pathPrefix: dto.pathPrefix || 'backups/',
      isDefault: count === 0,
      status: 'disconnected',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: user?.id || null,
    };
    return this.store.create('storage', this.encryptStorage(entity) as StorageEntity);
  }

  async update(
    id: string,
    dto: UpdateStorageDto,
    user?: AuthUser,
  ): Promise<StorageEntity | null> {
    const existing = await this.findOne(id, user);
    if (!existing) return null;
    const merged = { ...existing, ...dto, id, updatedAt: new Date().toISOString() };
    return this.store.create('storage', this.encryptStorage(merged) as StorageEntity);
  }

  async remove(id: string, user?: AuthUser): Promise<void> {
    const existing = await this.findOne(id, user);
    if (!existing) {
      throw new BadRequestException('Storage config not found or unauthorized');
    }
    const jobs = await this.store.findBy('jobs', (job: { storageId?: string }) => job.storageId === id);
    if (jobs.length > 0) {
      throw new BadRequestException('Cannot delete storage while jobs reference it');
    }
    await this.store.delete('storage', id);
  }

  async setDefault(id: string, user?: AuthUser): Promise<StorageEntity | null> {
    const existing = await this.findOne(id, user);
    if (!existing) {
      throw new BadRequestException('Storage config not found or unauthorized');
    }
    const all = await this.store.getAll<StorageEntity>('storage');
    for (const s of all) {
      if (s.isDefault) {
        await this.store.update<StorageEntity>('storage', s.id, {
          isDefault: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return this.store.update<StorageEntity>('storage', id, {
      isDefault: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async testConnection(
    dto: CreateStorageDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createS3Client({
        endpoint: normalizeEndpoint(dto.endpoint),
        region: dto.region || 'us-east-1',
        accessKeyId: dto.accessKeyId,
        secretAccessKey: dto.secretAccessKey,
      });
      await client.send(new HeadBucketCommand({ Bucket: dto.bucket }));
      return { success: true, message: `Connected to bucket "${dto.bucket}"` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection failed' };
    }
  }

  createS3Client(config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }): S3Client {
    return new S3Client({
      endpoint: normalizeEndpoint(config.endpoint),
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(
    storage: StorageEntity,
    key: string,
    data: Buffer | Readable,
  ): Promise<{ key: string }> {
    const client = this.createS3Client(storage);
    const fullKey = `${storage.pathPrefix}${key}`;
    
    const upload = new Upload({
      client,
      params: {
        Bucket: storage.bucket,
        Key: fullKey,
        Body: data,
        ContentType: 'application/gzip',
      },
    });

    await upload.done();
    return { key: fullKey };
  }

  async generateDownloadUrl(
    storage: StorageEntity,
    key: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const client = this.createS3Client(storage);
    const command = new GetObjectCommand({ Bucket: storage.bucket, Key: key });
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { url, expiresAt: new Date(Date.now() + 3600000).toISOString() };
  }

  async downloadFileStream(storage: StorageEntity, key: string): Promise<Readable> {
    const client = this.createS3Client(storage);
    const response = await client.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
    );
    const body = response.Body;
    if (!body) throw new Error('File not found or empty body');
    return body as Readable;
  }

  async deleteFile(storage: StorageEntity, key: string): Promise<void> {
    const client = this.createS3Client(storage);
    await client.send(
      new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }),
    );
  }

  async getFileSize(storage: StorageEntity, key: string): Promise<number> {
    const client = this.createS3Client(storage);
    const response = await client.send(
      new HeadObjectCommand({ Bucket: storage.bucket, Key: key }),
    );
    return response.ContentLength || 0;
  }
}
