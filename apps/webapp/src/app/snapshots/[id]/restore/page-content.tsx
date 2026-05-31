'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Plus, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { DatabaseForm } from '@/app/databases/page-content';
import { databasesApi, jobsApi, snapshotsApi } from '@/lib/api-routes';
import { formatBytes, formatDate } from '@/lib/utils';
import type { Database, Snapshot } from '@/types';

function restoreJobName(snapshot: Snapshot) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `Restore ${snapshot.databaseName} ${timestamp}`;
}

export function RestoreSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [targetDatabaseId, setTargetDatabaseId] = useState('');
  const [cleanBeforeRestore, setCleanBeforeRestore] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([snapshotsApi.get(id), databasesApi.list()])
      .then(([snapshotRes, databaseRes]) => {
        setSnapshot(snapshotRes);
        setDatabases(databaseRes);
        setTargetDatabaseId(snapshotRes.databaseId);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load restore details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const targetDatabase = useMemo(
    () => databases.find((db) => db.id === targetDatabaseId) || null,
    [databases, targetDatabaseId],
  );

  const refreshDatabases = async (selectedDatabaseId?: string) => {
    const databaseRes = await databasesApi.list();
    setDatabases(databaseRes);
    if (selectedDatabaseId) {
      setTargetDatabaseId(selectedDatabaseId);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!snapshot || !targetDatabaseId) return;
    setError(null);
    setShowConfirm(true);
  };

  const executeRestore = async () => {
    if (!snapshot || !targetDatabaseId) return;

    setSaving(true);
    setError(null);

    try {
      await jobsApi.create({
        name: restoreJobName(snapshot),
        databaseId: targetDatabaseId,
        storageId: snapshot.storageId,
        type: 'restore',
        options: {
          snapshotId: snapshot.id,
          targetDatabaseId,
          cleanBeforeRestore,
          compress: true,
          encrypt: false,
        },
      });
      router.push('/jobs?source=manual');
    } catch (err) {
      console.error(err);
      setError('Failed to create restore job.');
      setSaving(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Snapshot not found.</p>;
  }

  const canRestore = snapshot.status === 'completed';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Restore Snapshot</h1>
          <p className="text-muted-foreground">
            Restoring {snapshot.databaseName} from {formatDate(snapshot.createdAt)}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/snapshots')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Restore Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Target Database</label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowTargetForm(true)}>
                    <Plus className="h-4 w-4" /> Add Target DB
                  </Button>
                </div>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={targetDatabaseId}
                  onChange={(event) => setTargetDatabaseId(event.target.value)}
                  required
                >
                  <option value="">Select database...</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.label || db.name} ({db.type}) - {db.database}
                    </option>
                  ))}
                </select>
                {targetDatabase && targetDatabase.type !== snapshot.databaseType && (
                  <p className="mt-2 text-sm text-destructive">
                    Target type is {targetDatabase.type}; this snapshot is {snapshot.databaseType}.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-md border border-input p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={cleanBeforeRestore}
                  onChange={(event) => setCleanBeforeRestore(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">Clean target before restore</span>
                  <span className="text-muted-foreground">
                    Use this only when the target can be overwritten.
                  </span>
                </span>
              </label>

              {!canRestore && (
                <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This snapshot is {snapshot.status}, so it cannot be restored yet.</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.push('/snapshots')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !canRestore || !targetDatabaseId}>
                  <RotateCcw className="h-4 w-4" />
                  {saving ? 'Creating...' : 'Create Restore Job'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Badge className="capitalize">{snapshot.status}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Database</span>
              <span className="text-right font-medium">{snapshot.databaseName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{snapshot.databaseType}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{formatBytes(snapshot.compressedSize)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Created</span>
              <span className="text-right">{formatDate(snapshot.createdAt)}</span>
            </div>
            <div className="border-t pt-3">
              <span className="text-muted-foreground">Storage key</span>
              <p className="mt-1 break-all font-mono text-xs">{snapshot.storageKey || 'Not uploaded yet'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showTargetForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-target-db-title"
          onMouseDown={() => setShowTargetForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 id="add-target-db-title" className="text-lg font-semibold">Add Target DB</h2>
                <p className="text-sm text-muted-foreground">
                  Add a {snapshot.databaseType} database connection for this restore.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowTargetForm(false)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="p-4">
              <DatabaseForm
                defaultType={snapshot.databaseType}
                onCancel={() => setShowTargetForm(false)}
                onSuccess={async (database) => {
                  await refreshDatabases(database?.id);
                  setShowTargetForm(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={() => !saving && setShowConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Restore
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm">
                You are about to restore the snapshot <strong>{snapshot.databaseName}</strong> to the target database <strong>{targetDatabase ? (targetDatabase.label || targetDatabase.name) : 'Unknown'}</strong>.
              </p>
              {cleanBeforeRestore && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <strong>Warning:</strong> "Clean target before restore" is checked. The <strong>entire target database will be dropped</strong> before restoring. Any existing data will be permanently lost!
                </div>
              )}
              <p className="text-sm text-muted-foreground">Are you sure you want to proceed?</p>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowConfirm(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={executeRestore} 
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner className="mr-2" size="sm" />
                      Restoring...
                    </>
                  ) : (
                    'Yes, Start Restore'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
