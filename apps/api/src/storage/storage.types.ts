export type StorageProvider =
  | 's3'
  | 'cloudflare-r2'
  | 'minio'
  | 'rustfs'
  | 'wasabi'
  | 'backblaze';
export type StorageStatus = 'connected' | 'disconnected' | 'error';

export interface StorageEntity {
  id: string;
  name: string;
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix: string;
  isDefault: boolean;
  status: StorageStatus;
  createdAt: string;
  updatedAt: string;
}

export class CreateStorageDto {
  name: string;
  provider: StorageProvider;
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix?: string;
}

export class UpdateStorageDto {
  name?: string;
  provider?: StorageProvider;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  pathPrefix?: string;
}
