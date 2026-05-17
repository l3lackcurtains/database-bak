export type SnapshotStatus =
  | 'pending'
  | 'creating'
  | 'completed'
  | 'failed'
  | 'restoring';

export interface SnapshotEntity {
  id: string;
  databaseId: string;
  databaseName: string;
  databaseType: 'postgres' | 'mongodb';
  storageId: string;
  storageKey: string;
  size: number;
  compressedSize: number;
  checksum: string;
  status: SnapshotStatus;
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

export class CreateSnapshotDto {
  databaseId: string;
  databaseName: string;
  databaseType: 'postgres' | 'mongodb';
  storageId: string;
}
