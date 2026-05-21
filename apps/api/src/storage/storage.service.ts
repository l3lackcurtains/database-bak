import { BadRequestException, Injectable } from '@nestjs/common';
import { TursoStore } from '../common/turso.store';
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
  constructor(private store: TursoStore) {}

  async findAll(): Promise<StorageEntity[]> {
    return this.store.getAll<StorageEntity>('storage');
  }

  async findOne(id: string): Promise<StorageEntity | null> {
    return (await this.store.getById<StorageEntity>('storage', id)) || null;
  }

  async getDefault(): Promise<StorageEntity | null> {
    const found = await this.store.findBy('storage', (s: StorageEntity) => s.isDefault);
    return found[0] || null;
  }

  async create(dto: CreateStorageDto): Promise<StorageEntity> {
    const count = await this.store.count('storage');
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity: StorageEntity = {
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
    };
    return this.store.create('storage', entity);
  }

  async update(
    id: string,
    dto: UpdateStorageDto,
  ): Promise<StorageEntity | null> {
    return this.store.update<StorageEntity>('storage', id, {
      ...dto,
      updatedAt: new Date().toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    const jobs = await this.store.findBy('jobs', (job: { storageId?: string }) => job.storageId === id);
    if (jobs.length > 0) {
      throw new BadRequestException('Cannot delete storage while jobs reference it');
    }
    await this.store.delete('storage', id);
  }

  async setDefault(id: string): Promise<StorageEntity | null> {
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
