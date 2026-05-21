'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database as DatabaseIcon, HardDrive, CalendarClock, Server, Globe, ShieldCheck, Activity, Copy, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { databasesApi, snapshotsApi, jobsApi } from '@/lib/api-routes';
import { formatDate, formatBytes } from '@/lib/utils';
import type { Database, Snapshot, BackupJob } from '@/types';

function statusBadge(status: string) {
  const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    completed: 'success',
    success: 'success',
    failed: 'destructive',
    running: 'warning',
    pending: 'secondary',
    cancelled: 'secondary',
    creating: 'warning',
    restoring: 'warning',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function typeBadge(type: string) {
  return <Badge variant={type === 'mongodb' ? 'success' : 'info'} className="capitalize">{type}</Badge>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[220px] break-all text-right font-medium">{value}</div>
    </div>
  );
}

export function DatabaseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [db, setDb] = useState<Database | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dbData, snapData, jobsData] = await Promise.all([
        databasesApi.get(id),
        snapshotsApi.list({ databaseId: id }),
        jobsApi.list({ databaseId: id }),
      ]);
      setDb(dbData);
      setSnapshots(snapData.data);
      setJobs(jobsData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTest = async () => {
    if (!db) return;
    try {
      const res = await databasesApi.test({ type: db.type, host: db.host, port: db.port, database: db.database, username: db.username, password: db.password, url: db.url, ssl: db.ssl });
      alert(res.success ? `Connected: ${res.message}` : `Failed: ${res.message}`);
    } catch (err: any) {
      alert(err.message || 'Connection test failed');
    }
  };

  const handleDelete = async () => {
    if (!db || !confirm('Delete this database connection?')) return;
    await databasesApi.delete(id);
    router.push('/databases');
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!db) {
    return <p className="text-sm text-muted-foreground">Database not found.</p>;
  }

  const totalSize = snapshots.reduce((sum, s) => sum + (s.compressedSize || 0), 0);
  const latestSnapshot = snapshots.length > 0 ? snapshots.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">{db.label || db.name}</h1>
            {typeBadge(db.type)}
          </div>
          <p className="text-muted-foreground">{db.host}:{db.port}/{db.database}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => router.push('/databases')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" onClick={handleTest}>
            <Activity className="h-4 w-4" /> Test
          </Button>
          <Button variant="outline" onClick={() => router.push(`/jobs/manual?databaseId=${id}`)}>
            <Copy className="h-4 w-4" /> Backup Now
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Snapshots</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{snapshots.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Total Size</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatBytes(totalSize)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Jobs</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{jobs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Latest Snapshot</CardTitle></CardHeader>
          <CardContent className="text-sm font-medium">{latestSnapshot ? formatDate(latestSnapshot.createdAt) : 'None'}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Snapshots ({snapshots.length})</CardTitle></CardHeader>
            <CardContent>
              {snapshots.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No snapshots yet.</p>
              ) : (
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                        <TableCell className="text-sm">{formatBytes(s.compressedSize)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">{s.sourceType || 'manual'}</Badge>
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/snapshots/${s.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Jobs ({jobs.length})</CardTitle></CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No jobs configured.</p>
              ) : (
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          <Link href={`/jobs/${j.id}`} className="hover:underline">{j.name}</Link>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{j.type}</Badge></TableCell>
                        <TableCell>{statusBadge(j.status)}</TableCell>
                        <TableCell className="text-sm">{j.schedule ? 'Scheduled' : 'Manual'}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/jobs/${j.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <DatabaseIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{db.label ? 'Label' : 'Name'}</div>
                  <div className="text-muted-foreground">{db.label || db.name}</div>
                </div>
              </div>
              <DetailRow label="Type" value={db.type} />
              <DetailRow label="Host" value={`${db.host}:${db.port}`} />
              <DetailRow label="Database" value={db.database} />
              <DetailRow label="Username" value={db.username || '—'} />
              <DetailRow label="SSL" value={db.ssl ? 'Enabled' : 'Disabled'} />
              {db.url && <DetailRow label="URL" value={db.url.replace(/\/\/([^:@]+):([^@]+)@/, '//$1:***@')} />}
              <DetailRow label="Created" value={formatDate(db.createdAt)} />
              <DetailRow label="Updated" value={formatDate(db.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Storage Overview</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Snapshots</span>
                <span className="font-medium">{snapshots.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Size</span>
                <span className="font-medium">{formatBytes(totalSize)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Jobs</span>
                <span className="font-medium">{jobs.filter(j => j.status === 'running').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed Jobs</span>
                <span className="font-medium text-destructive">{jobs.filter(j => j.status === 'failed').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
