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
  ssl: boolean;
  status: DatabaseStatus;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateDatabaseDto {
  name?: string;
  type?: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  url?: string;
}

export class UpdateDatabaseDto {
  name?: string;
  type?: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  url?: string;
}

export function parseDatabaseUrl(
  url: string,
): Partial<CreateDatabaseDto> | null {
  try {
    if (
      !url.startsWith('postgresql://') &&
      !url.startsWith('postgres://') &&
      !url.startsWith('mongodb://') &&
      !url.startsWith('mongodb+srv://')
    ) {
      return null;
    }

    const isMongo = url.startsWith('mongodb');
    const type = isMongo ? ('mongodb' as const) : ('postgres' as const);
    const cleanUrl = url
      .replace('postgres://', 'postgresql://')
      .replace('mongodb+srv://', 'mongodb://');
    const parsed = new URL(cleanUrl);

    const dbPath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    const port = parsed.port
      ? parseInt(parsed.port)
      : type === 'postgres'
        ? 5432
        : 27017;
    const sslMode = parsed.searchParams.get('sslmode');
    const sslParam = parsed.searchParams.get('ssl');
    const postgresSsl =
      sslMode === 'require' ||
      sslMode === 'verify-ca' ||
      sslMode === 'verify-full' ||
      sslParam === 'true';

    return {
      name: dbPath || parsed.hostname,
      type,
      host: parsed.hostname,
      port,
      database: dbPath,
      username: parsed.username ? decodeURIComponent(parsed.username) : '',
      password: parsed.password ? decodeURIComponent(parsed.password) : '',
      ssl: isMongo ? url.startsWith('mongodb+srv://') : postgresSsl,
    };
  } catch {
    return null;
  }
}
