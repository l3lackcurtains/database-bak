export type DatabaseType = 'postgres' | 'mongodb';
export type DatabaseStatus = 'connected' | 'disconnected' | 'error';

export interface DatabaseEntity {
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
  status: DatabaseStatus;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
