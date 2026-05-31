'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { databasesApi } from '@/lib/api-routes';
import { ApiError } from '@/lib/api';
import type { Database } from '@/types';
import { Copy, Plus, Trash2, RefreshCw, Link2, Edit3, Lock } from 'lucide-react';

export function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<Database | null>(null);
  const [cloningDatabase, setCloningDatabase] = useState<Database | null>(null);

  const fetchDatabases = () => {
    databasesApi.list()
      .then(setDatabases)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDatabases(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this database connection?')) return;
    try {
      await databasesApi.delete(id);
      fetchDatabases();
    } catch (err: any) {
      alert(err.message || 'Failed to delete database');
    }
  };

  const handleTest = async (db: Partial<Database>) => {
    try {
      const res = await databasesApi.test(db);
      alert(res.success ? `Connected: ${res.message}` : `Failed: ${res.message}`);
    } catch (error) {
      alert(error instanceof ApiError ? error.message : 'Connection test failed');
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Databases</h1>
          <p className="text-muted-foreground">Manage your database connections</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={fetchDatabases}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => { setEditingDatabase(null); setCloningDatabase(null); setShowForm(!showForm); }}>
            <Plus className="h-4 w-4" /> Add Database
          </Button>
        </div>
      </div>

      {(showForm || editingDatabase || cloningDatabase) && (
        <DatabaseForm
          key={`${editingDatabase ? 'edit' : cloningDatabase ? 'clone' : 'new'}-${(editingDatabase || cloningDatabase)?.id || 'empty'}`}
          database={editingDatabase || cloningDatabase}
          clone={Boolean(cloningDatabase)}
          onCancel={() => {
            setShowForm(false);
            setEditingDatabase(null);
            setCloningDatabase(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingDatabase(null);
            setCloningDatabase(null);
            fetchDatabases();
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connections ({databases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {databases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No database connections configured. Add one to get started.
            </p>
          ) : (
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Connection</TableHead>
                  <TableHead className="w-[320px]">Target</TableHead>
                  <TableHead className="w-[190px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {databases.map((db) => (
                  <TableRow key={db.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <button className="max-w-[220px] truncate font-medium text-left hover:underline cursor-pointer" onClick={() => router.push(`/databases/${db.id}`)}>{db.label || db.name}</button>
                        <Badge variant="secondary" className="capitalize">{db.type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="max-w-[320px] truncate font-mono text-sm">{db.host}:{db.port}</div>
                        <div className="max-w-[320px] truncate text-sm text-muted-foreground">{db.database}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowForm(false);
                            setCloningDatabase(null);
                            setEditingDatabase(db);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowForm(false);
                            setEditingDatabase(null);
                            setCloningDatabase(db);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(db.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DatabaseForm({
  database,
  clone = false,
  defaultType = 'postgres',
  onCancel,
  onSuccess,
}: {
  database?: Database | null;
  clone?: boolean;
  defaultType?: Database['type'];
  onCancel: () => void;
  onSuccess: (database?: Database) => void | Promise<void>;
}) {
  const isEditing = Boolean(database) && !clone;
  const isCloning = Boolean(database) && clone;
  const [mode, setMode] = useState<'url' | 'fields'>(database?.url ? 'url' : 'fields');
  const [connectionUrl, setConnectionUrl] = useState(database?.url || '');
  const [form, setForm] = useState({
    name: isCloning && database?.name ? `${database.name} copy` : database?.name || '',
    label: database?.label || '',
    type: database?.type || defaultType,
    host: database?.host || '',
    port: database?.port || 5432,
    database: database?.database || '',
    username: database?.username || '',
    password: database?.password || '',
    ssl: database?.ssl || false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const parseUrl = (url: string) => {
    try {
      if (!url.startsWith('postgresql://') && !url.startsWith('postgres://') && !url.startsWith('mongodb://') && !url.startsWith('mongodb+srv://')) {
        return null;
      }

      const isMongo = url.startsWith('mongodb');
      const type = isMongo ? 'mongodb' as const : 'postgres' as const;
      const cleanUrl = url.replace('postgres://', 'postgresql://').replace('mongodb+srv://', 'mongodb://');
      const parsed = new URL(cleanUrl);

      const dbPath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      const port = parsed.port ? parseInt(parsed.port) : (type === 'postgres' ? 5432 : 27017);
      const sslMode = parsed.searchParams.get('sslmode');
      const sslParam = parsed.searchParams.get('ssl');
      const postgresSsl = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || sslParam === 'true';

      return {
        name: dbPath || `${parsed.hostname}-db`,
        label: '',
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
  };

  const handleUrlChange = (url: string) => {
    setConnectionUrl(url);
    const parsed = parseUrl(url);
    if (parsed) {
      setForm(parsed);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await databasesApi.test(mode === 'url' ? { ...form, url: connectionUrl.trim() } : form);
      setTestResult(res);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof ApiError ? error.message : 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = mode === 'url' ? { ...form, url: connectionUrl.trim() } : form;
      let savedDatabase: Database;
      if (isEditing && database) {
        savedDatabase = await databasesApi.update(database.id, payload);
      } else {
        savedDatabase = await databasesApi.create(payload);
      }
      await onSuccess(savedDatabase);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof ApiError ? error.message : `Failed to ${isEditing ? 'update' : isCloning ? 'clone' : 'add'} database connection`,
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{isEditing ? 'Edit Database Connection' : isCloning ? 'Clone Database Connection' : 'Add Database Connection'}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={mode === 'url' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('url')}
          >
            <Link2 className="h-4 w-4 mr-1" /> Connection URL
          </Button>
          <Button
            variant={mode === 'fields' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('fields')}
          >
            <Edit3 className="h-4 w-4 mr-1" /> Manual
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'url' ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Connection URL</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={connectionUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/mydb"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supported: <code className="bg-muted px-1 rounded">postgresql://</code>, <code className="bg-muted px-1 rounded">postgres://</code>, <code className="bg-muted px-1 rounded">mongodb://</code>, <code className="bg-muted px-1 rounded">mongodb+srv://</code>
              </p>
              {form.host && (
                <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                  <p><span className="font-medium">Type:</span> {form.type}</p>
                  <p><span className="font-medium">Host:</span> {form.host}:{form.port}</p>
                  <p><span className="font-medium">Database:</span> {form.database}</p>
                  <p><span className="font-medium">Username:</span> {form.username}</p>
                  <div className="pt-2 border-t border-border mt-2">
                    <label className="text-xs font-medium">Label <span className="text-muted-foreground">(optional)</span></label>
                    <input
                      className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="Display name"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({
                    ...form,
                    type: e.target.value as 'postgres' | 'mongodb',
                    port: e.target.value === 'postgres' ? 5432 : 27017,
                  })}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mongodb">MongoDB</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Production DB" required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Label <span className="text-muted-foreground">(optional)</span></label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="My Database"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Host</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="localhost" required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Port</label>
                <input
                  type="number"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Database</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })}
                  placeholder="mydb" required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Username</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.ssl}
                    onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Use SSL
                </label>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`p-3 rounded-md text-sm ${testResult.success ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'}`}>
              {testResult.message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Credentials encrypted at rest
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="button" variant="secondary" onClick={handleTest} disabled={testing || !form.host}>
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button type="submit" disabled={!form.host || !form.database}>
                {isEditing ? 'Save Changes' : isCloning ? 'Create Clone' : 'Add Connection'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
