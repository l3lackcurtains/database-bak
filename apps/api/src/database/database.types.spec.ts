import { parseDatabaseUrl } from './database.types';

describe('parseDatabaseUrl', () => {
  it('parses postgres URLs with sslmode and encoded credentials', () => {
    expect(
      parseDatabaseUrl(
        'postgresql://user%40app:p%40ss@db.example.com:6543/app_db?sslmode=require',
      ),
    ).toEqual({
      name: 'app_db',
      type: 'postgres',
      host: 'db.example.com',
      port: 6543,
      database: 'app_db',
      username: 'user@app',
      password: 'p@ss',
      ssl: true,
    });
  });

  it('parses mongodb srv URLs without discarding srv intent', () => {
    expect(
      parseDatabaseUrl('mongodb+srv://admin:secret@cluster.example.com/app'),
    ).toEqual({
      name: 'app',
      type: 'mongodb',
      host: 'cluster.example.com',
      port: 27017,
      database: 'app',
      username: 'admin',
      password: 'secret',
      ssl: true,
    });
  });
});
