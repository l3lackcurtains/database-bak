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

export class CreateJobDto {
  name: string;
  databaseId: string;
  storageId: string;
  type: JobType;
  schedule?: {
    frequency: ScheduleFrequency;
    cronExpression?: string;
    timezone?: string;
  };
  options?: {
    compress?: boolean;
    encrypt?: boolean;
    targetDatabaseId?: string;
  };
}

export class UpdateJobDto {
  name?: string;
  databaseId?: string;
  storageId?: string;
  type?: JobType;
  schedule?: {
    frequency: ScheduleFrequency;
    cronExpression?: string;
    timezone?: string;
  } | null;
  options?: {
    compress?: boolean;
    encrypt?: boolean;
    targetDatabaseId?: string;
  };
}
