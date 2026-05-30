'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { storageApi } from '@/lib/api-routes';
import { ApiError } from '@/lib/api';
import type { StorageConfig } from '@/types';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, RefreshCw, Star, Edit3, Lock } from 'lucide-react';

export function StoragePage() {
  const router = useRouter();
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStorage, setEditingStorage] = useState<StorageConfig | null>(null);

  const fetchStorage = () => {
    storageApi.list()
      .then(setStorageConfigs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStorage(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this storage configuration?')) return;
    try {
      await storageApi.delete(id);
      fetchStorage();
    } catch (err: any) {
      alert(err.message || 'Failed to delete storage');
    }
  };

  const handleSetDefault = async (id: string) => {
    await storageApi.setDefault(id);
    fetchStorage();
  };

  const handleTest = async (storage: Partial<StorageConfig>) => {
    try {
      const res = await storageApi.test(storage);
      alert(res.success ? `Connected: ${res.message}` : `Failed: ${res.message}`);
    } catch (error) {
      alert(error instanceof ApiError ? error.message : 'Storage test failed');
    }
  };

  const providerLabel = (provider: string) => {
    const labels: Record<string, string> = {
      s3: 'Amazon S3', 'cloudflare-r2': 'Cloudflare R2', minio: 'MinIO',
      rustfs: 'RustFS', wasabi: 'Wasabi', backblaze: 'Backblaze B2',
    };
    return labels[provider] || provider;
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
          <p className="text-muted-foreground">Configure S3-compatible storage for backups</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={fetchStorage}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => { setEditingStorage(null); setShowForm(!showForm); }}>
            <Plus className="h-4 w-4" /> Add Storage
          </Button>
        </div>
      </div>

      {(showForm || editingStorage) && (
        <StorageForm
          storage={editingStorage}
          onCancel={() => {
            setShowForm(false);
            setEditingStorage(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingStorage(null);
            fetchStorage();
          }}
        />
      )}

      <Card>
        <CardHeader><CardTitle>Storage Configurations</CardTitle></CardHeader>
        <CardContent>
          {storageConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No storage configured. Add an S3-compatible storage to store backups.
            </p>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Configuration</TableHead>
                  <TableHead className="w-[360px]">Storage</TableHead>
                  <TableHead className="w-[210px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storageConfigs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <button className="max-w-[220px] truncate font-medium text-left hover:underline cursor-pointer" onClick={() => router.push(`/storage/${s.id}`)}>{s.label || s.name}</button>
                        <Badge variant="secondary">{providerLabel(s.provider)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="max-w-[300px] truncate font-mono text-sm">{s.bucket}</div>
                        <div className="max-w-[300px] truncate font-mono text-xs text-muted-foreground">{s.endpoint}</div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {s.isDefault ? (
                            <Badge variant="success"><Star className="h-3 w-3 mr-1" /> Default</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-0" onClick={() => handleSetDefault(s.id)}>
                              Set Default
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowForm(false);
                            setEditingStorage(s);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
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

function StorageForm({
  storage,
  onCancel,
  onSuccess,
}: {
  storage?: StorageConfig | null;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(storage);
  const [form, setForm] = useState({
    name: storage?.name || '',
    label: storage?.label || '',
    provider: storage?.provider || ('s3' as StorageConfig['provider']),
    endpoint: storage?.endpoint || '',
    region: storage?.region || 'us-east-1',
    bucket: storage?.bucket || '',
    accessKeyId: storage?.accessKeyId || '',
    secretAccessKey: storage?.secretAccessKey || '',
    pathPrefix: storage?.pathPrefix || 'backups/',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await storageApi.test(form);
      setTestResult(res);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof ApiError ? error.message : 'Storage test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (storage) {
        await storageApi.update(storage.id, form);
      } else {
        await storageApi.create(form);
      }
      onSuccess();
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof ApiError ? error.message : `Failed to ${isEditing ? 'update' : 'add'} storage configuration`,
      });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{isEditing ? 'Edit Storage Configuration' : 'Add Storage Configuration'}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Name</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Production S3" required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Label <span className="text-muted-foreground">(optional)</span></label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="My Storage"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as typeof form.provider })}
              >
                <option value="s3">Amazon S3</option>
                <option value="cloudflare-r2">Cloudflare R2</option>
                <option value="minio">MinIO</option>
                <option value="rustfs">RustFS</option>
                <option value="wasabi">Wasabi</option>
                <option value="backblaze">Backblaze B2</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Endpoint</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="s3.amazonaws.com" required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Region</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="us-east-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Bucket</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })}
                placeholder="db-backups" required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Path Prefix</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.pathPrefix} onChange={(e) => setForm({ ...form, pathPrefix: e.target.value })}
                placeholder="backups/"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Access Key ID</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.accessKeyId} onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Secret Access Key</label>
              <input
                type="password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.secretAccessKey} onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
                required
              />
            </div>
          </div>
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
              <Button
                type="button"
                variant="secondary"
                onClick={handleTest}
                disabled={testing || !form.endpoint || !form.bucket || !form.accessKeyId || !form.secretAccessKey}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Storage'}</Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
