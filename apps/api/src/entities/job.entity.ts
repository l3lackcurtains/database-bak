export type JobType = 'backup' | 'restore' | 'migrate';
export type JobStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';
export type ScheduleFrequency =
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

export interface JobEntity {
  id: string;
  name: string;
  databaseId: string;
  databaseName: string;
  storageId: string;
  type: JobType;
  status: JobStatus;
  schedule: {
    frequency: ScheduleFrequency;
    frequencies?: ScheduleFrequency[];
    intervalHours?: number;
    intervalsHours?: number[];
    cronExpression: string | null;
    nextRunAt: string | null;
    nextRunReason?: string | null;
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
    snapshotId?: string;
    retention?: {
      hourly?: number;
      daily?: number;
      weekly?: number;
      monthly?: number;
    };
  };
  runCount: number;
  failedRunCount: number;
  progress: number;
  currentStep: string;
  snapshotId: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  details?: {
    sourceDatabase: JobDatabaseDetails | null;
    destinationDatabase: JobDatabaseDetails | null;
    storage: JobStorageDetails | null;
    snapshot: JobSnapshotDetails | null;
  };
}

export interface JobDatabaseDetails {
  id: string;
  name: string;
  label?: string;
  type: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  ssl?: boolean;
  url?: string;
}

export interface JobStorageDetails {
  id: string;
  name: string;
  label?: string;
  provider: string;
  endpoint: string;
  region: string;
  bucket: string;
  pathPrefix: string;
}

export interface JobSnapshotDetails {
  id: string;
  databaseName: string;
  databaseType: string;
  storageKey: string;
  size: number;
  compressedSize: number;
  checksum: string;
  createdAt: string;
  completedAt: string | null;
  metadata?: Record<string, any>;
}
