export type DatabaseType = 'postgres' | 'mongodb';

export interface DatabaseEntity {
  id: string;
  name: string;
  label?: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  url?: string;
  ssl: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}
