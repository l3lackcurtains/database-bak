export type DatabaseType = 'postgres' | 'mongodb';

export type StorageProvider = 's3' | 'cloudflare-r2' | 'minio' | 'rustfs' | 'wasabi' | 'backblaze';

export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type JobType = 'backup' | 'restore' | 'migrate';

export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Database {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  url?: string;
  ssl: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorageConfig {
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
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  databaseId: string;
  databaseName: string;
  databaseType: DatabaseType;
  storageId: string;
  storageKey: string;
  size: number;
  compressedSize: number;
  checksum: string;
  status: 'pending' | 'creating' | 'completed' | 'failed' | 'restoring';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  metadata: {
    version: string;
    collections?: string[];
    tables?: string[];
    recordCount?: number;
  };
  createdAt: string;
}

export interface BackupJob {
  id: string;
  name: string;
  databaseId: string;
  databaseName: string;
  storageId: string;
  type: JobType;
  status: JobStatus;
  schedule: {
    frequency: ScheduleFrequency;
    cronExpression: string | null;
    nextRunAt: string | null;
    timezone: string;
  } | null;
  options: {
    compress: boolean;
    encrypt: boolean;
    includeCollections?: string[];
    excludeCollections?: string[];
    includeTables?: string[];
    excludeTables?: string[];
    cleanBeforeRestore?: boolean;
    targetDatabaseId?: string;
  };
  progress: number;
  currentStep: string;
  snapshotId: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalDatabases: number;
  totalSnapshots: number;
  totalStorageUsed: number;
  activeJobs: number;
  successfulBackups24h: number;
  failedBackups24h: number;
  nextScheduledRun: string | null;
}

export interface MigrationConfig {
  sourceDatabaseId: string;
  targetDatabaseId: string;
  snapshotId?: string;
  cleanTarget: boolean;
}

export interface ApiErrorResponse {
  message: string;
  error: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
