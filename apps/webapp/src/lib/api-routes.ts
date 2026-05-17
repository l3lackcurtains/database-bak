import { api } from '@/lib/api';
import type {
  Database,
  StorageConfig,
  Snapshot,
  BackupJob,
  DashboardStats,
  PaginatedResponse,
  MigrationConfig,
} from '@/types';

export type DatabasePayload = Partial<Database> & { url?: string; password?: string };

export const databasesApi = {
  list: () => api.get<Database[]>('/databases'),
  get: (id: string) => api.get<Database>(`/databases/${id}`),
  create: (data: DatabasePayload) => api.post<Database>('/databases', data),
  update: (id: string, data: DatabasePayload) =>
    api.patch<Database>(`/databases/${id}`, data),
  delete: (id: string) => api.delete<void>(`/databases/${id}`),
  test: (data: DatabasePayload) =>
    api.post<{ success: boolean; message: string }>('/databases/test', data),
};

export const storageApi = {
  list: () => api.get<StorageConfig[]>('/storage'),
  get: (id: string) => api.get<StorageConfig>(`/storage/${id}`),
  create: (data: Partial<StorageConfig>) => api.post<StorageConfig>('/storage', data),
  update: (id: string, data: Partial<StorageConfig>) =>
    api.patch<StorageConfig>(`/storage/${id}`, data),
  delete: (id: string) => api.delete<void>(`/storage/${id}`),
  test: (data: Partial<StorageConfig>) =>
    api.post<{ success: boolean; message: string }>('/storage/test', data),
  setDefault: (id: string) => api.patch<StorageConfig>(`/storage/${id}/default`),
};

export const snapshotsApi = {
  list: (params?: { page?: number; limit?: number; databaseId?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.databaseId) query.set('databaseId', params.databaseId);
    const qs = query.toString();
    return api.get<PaginatedResponse<Snapshot>>(`/snapshots${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<Snapshot>(`/snapshots/${id}`),
  delete: (id: string) => api.delete<void>(`/snapshots/${id}`),
  restore: (id: string, targetDatabaseId: string, cleanTarget: boolean = false) =>
    api.post<BackupJob>(`/snapshots/${id}/restore`, { targetDatabaseId, cleanTarget }),
  downloadUrl: (id: string) =>
    api.get<{ url: string; expiresAt: string }>(`/snapshots/${id}/download`),
};

export const jobsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return api.get<PaginatedResponse<BackupJob>>(`/jobs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<BackupJob>(`/jobs/${id}`),
  create: (data: {
    name: string;
    databaseId: string;
    storageId: string;
    type: 'backup' | 'restore' | 'migrate';
    schedule?: {
      frequency: string;
      cronExpression?: string;
      timezone?: string;
    };
    options?: Record<string, unknown>;
  }) => api.post<BackupJob>('/jobs', data),
  update: (id: string, data: {
    name?: string;
    databaseId?: string;
    storageId?: string;
    type?: 'backup' | 'restore' | 'migrate';
    schedule?: {
      frequency: string;
      cronExpression?: string;
      timezone?: string;
    } | null;
    options?: Record<string, unknown>;
  }) => api.patch<BackupJob>(`/jobs/${id}`, data),
  cancel: (id: string) => api.patch<BackupJob>(`/jobs/${id}/cancel`),
  retry: (id: string) => api.post<BackupJob>(`/jobs/${id}/retry`),
  runNow: (id: string) => api.post<BackupJob>(`/jobs/${id}/run`),
  delete: (id: string) => api.delete<void>(`/jobs/${id}`),
};

export const migrationApi = {
  create: (data: MigrationConfig) => api.post<BackupJob>('/migrations', data),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
};
