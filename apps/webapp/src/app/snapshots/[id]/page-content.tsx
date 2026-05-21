'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database as DatabaseIcon, HardDrive, CalendarClock, FileArchive, Download, Trash2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { snapshotsApi, databasesApi, storageApi } from '@/lib/api-routes';
import { formatDate, formatBytes } from '@/lib/utils';
import type { Snapshot, Database, StorageConfig } from '@/types';

function statusBadge(status: string) {
  const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    completed: 'success',
    failed: 'destructive',
    creating: 'warning',
    pending: 'secondary',
    restoring: 'warning',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[220px] break-all text-right font-medium">{value}</div>
    </div>
  );
}

export function SnapshotDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [storage, setStorage] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const snapData = await snapshotsApi.get(id);
      setSnapshot(snapData);

      const [dbData, storageData] = await Promise.all([
        databasesApi.get(snapData.databaseId).catch(() => null),
        storageApi.get(snapData.storageId).catch(() => null),
      ]);
      setDb(dbData);
      setStorage(storageData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = async () => {
    try {
      const res = await snapshotsApi.downloadUrl(id);
      window.open(res.url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to generate download URL');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this snapshot?')) return;
    setDeleting(true);
    try {
      await snapshotsApi.delete(id);
      router.push('/snapshots');
    } catch (err: any) {
      alert(err.message || 'Failed to delete snapshot');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Snapshot not found.</p>;
  }

  const duration = snapshot.completedAt
    ? new Date(snapshot.completedAt).getTime() - new Date(snapshot.startedAt).getTime()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">{snapshot.databaseName}</h1>
            {statusBadge(snapshot.status)}
          </div>
          <p className="text-muted-foreground">Snapshot · {formatDate(snapshot.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => router.push('/snapshots')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {snapshot.status === 'completed' && (
            <>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4" /> Download
              </Button>
              <Link href={`/snapshots/${id}/restore`}>
                <Button>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              </Link>
            </>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Type</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold capitalize">{snapshot.databaseType}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Size</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatBytes(snapshot.compressedSize)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Duration</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {duration !== null ? `${Math.round(duration / 1000)}s` : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Source</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold capitalize">{snapshot.sourceType || 'Manual'}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="font-medium text-muted-foreground">Started</div>
                  <div>{formatDate(snapshot.startedAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Completed</div>
                  <div>{formatDate(snapshot.completedAt)}</div>
                </div>
              </div>
              {snapshot.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {snapshot.error}
                </div>
              )}
            </CardContent>
          </Card>

          {snapshot.metadata?.collections && snapshot.metadata.collections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Collections ({snapshot.metadata.collections.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.metadata.collections.map((col) => (
                    <Badge key={col} variant="secondary" className="font-mono text-xs">{col}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {snapshot.metadata?.tables && snapshot.metadata.tables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tables ({snapshot.metadata.tables.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.metadata.tables.map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {snapshot.sourceJobId && (
            <Card>
              <CardHeader><CardTitle>Source Job</CardTitle></CardHeader>
              <CardContent>
                <Link href={`/jobs/${snapshot.sourceJobId}`}>
                  <Button variant="outline" size="sm">
                    {snapshot.sourceJobName || 'View Job'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Source Database</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {db ? (
                <>
                  <div className="flex items-start gap-2">
                    <DatabaseIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{db.name}</div>
                      <div className="break-all text-sm text-muted-foreground">{db.host}:{db.port}</div>
                    </div>
                  </div>
                  <Link href={`/databases/${db.id}`}>
                    <Button variant="ghost" size="sm">View Database</Button>
                  </Link>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <DetailRow label="Name" value={snapshot.databaseName} />
                  <DetailRow label="Type" value={snapshot.databaseType} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Storage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {storage ? (
                <>
                  <div className="flex items-start gap-2">
                    <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{storage.name}</div>
                      <div className="text-sm text-muted-foreground">{storage.bucket}</div>
                    </div>
                  </div>
                  <Link href={`/storage/${storage.id}`}>
                    <Button variant="ghost" size="sm">View Storage</Button>
                  </Link>
                </>
              ) : (
                <DetailRow label="Storage ID" value={snapshot.storageId} />
              )}
              <DetailRow label="Storage Key" value={snapshot.storageKey} />
              <DetailRow label="Checksum" value={snapshot.checksum || '—'} />
              <DetailRow label="Raw Size" value={formatBytes(snapshot.size)} />
              <DetailRow label="Compressed" value={formatBytes(snapshot.compressedSize)} />
            </CardContent>
          </Card>

          {snapshot.metadata && (
            <Card>
              <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {snapshot.metadata.version && <DetailRow label="Version" value={snapshot.metadata.version} />}
                {snapshot.metadata.database && <DetailRow label="DB Name" value={snapshot.metadata.database} />}
                {snapshot.metadata.recordCount !== undefined && (
                  <DetailRow label="Records" value={snapshot.metadata.recordCount.toLocaleString()} />
                )}
                {snapshot.metadata.archive !== undefined && (
                  <DetailRow label="Archive" value={snapshot.metadata.archive ? 'Yes' : 'No'} />
                )}
                {snapshot.metadata.gzip !== undefined && (
                  <DetailRow label="Compressed" value={snapshot.metadata.gzip ? 'GZip' : 'No'} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
