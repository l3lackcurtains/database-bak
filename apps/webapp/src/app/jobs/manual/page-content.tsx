'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { databasesApi, jobsApi, storageApi } from '@/lib/api-routes';
import type { Database, StorageConfig } from '@/types';

function timestampName() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ManualBackupPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [storageConfigs, setStorageConfigs] = useState<StorageConfig[]>([]);
  const [databaseId, setDatabaseId] = useState('');
  const [storageId, setStorageId] = useState('');
  const [compress, setCompress] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([databasesApi.list(), storageApi.list()])
      .then(([databaseRes, storageRes]) => {
        setDatabases(databaseRes);
        setStorageConfigs(storageRes);
        setDatabaseId(databaseRes[0]?.id || '');
        setStorageId(storageRes.find((storage) => storage.isDefault)?.id || storageRes[0]?.id || '');
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load backup configuration.');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedDatabase = useMemo(
    () => databases.find((database) => database.id === databaseId) || null,
    [databases, databaseId],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDatabase || !storageId) return;

    setSaving(true);
    setError(null);

    try {
      await jobsApi.create({
        name: `Manual backup - ${selectedDatabase.name} - ${timestampName()}`,
        databaseId,
        storageId,
        type: 'backup',
        options: { compress, encrypt },
      });
      router.push('/jobs');
    } catch (err) {
      console.error(err);
      setError('Failed to start manual backup.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manual Backup</h1>
          <p className="text-muted-foreground">Run a one-time backup now</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/jobs')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Backup Target</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Database</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={databaseId}
                  onChange={(event) => setDatabaseId(event.target.value)}
                  required
                >
                  <option value="">Select database...</option>
                  {databases.map((database) => (
                    <option key={database.id} value={database.id}>
                      {database.name} ({database.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Storage</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={storageId}
                  onChange={(event) => setStorageId(event.target.value)}
                  required
                >
                  <option value="">Select storage...</option>
                  {storageConfigs.map((storage) => (
                    <option key={storage.id} value={storage.id}>
                      {storage.name} ({storage.provider})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={compress}
                  onChange={(event) => setCompress(event.target.checked)}
                  className="h-4 w-4"
                />
                Compress backup
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={encrypt}
                  onChange={(event) => setEncrypt(event.target.checked)}
                  className="h-4 w-4"
                />
                Encrypt backup
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/jobs')}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !databaseId || !storageId}>
                <Play className="h-4 w-4" />
                {saving ? 'Starting...' : 'Run Backup Now'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
