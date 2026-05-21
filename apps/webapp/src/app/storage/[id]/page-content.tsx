'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, HardDrive, Database, CalendarClock, Globe, ShieldCheck, Activity, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { storageApi, jobsApi } from '@/lib/api-routes';
import { formatDate } from '@/lib/utils';
import type { StorageConfig, BackupJob } from '@/types';

function statusBadge(status: string) {
  const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    completed: 'success',
    success: 'success',
    failed: 'destructive',
    running: 'warning',
    pending: 'secondary',
    cancelled: 'secondary',
    connected: 'success',
    disconnected: 'secondary',
    error: 'destructive',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    s3: 'S3',
    'cloudflare-r2': 'Cloudflare R2',
    minio: 'MinIO',
    rustfs: 'RustFS',
    wasabi: 'Wasabi',
    backblaze: 'Backblaze',
  };
  return labels[provider] || provider;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[220px] break-all text-right font-medium">{value}</div>
    </div>
  );
}

export function StorageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [storage, setStorage] = useState<StorageConfig | null>(null);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [storageData, jobsData] = await Promise.all([
        storageApi.get(id),
        jobsApi.list(),
      ]);
      setStorage(storageData);
      setJobs(jobsData.data.filter((j: BackupJob) => j.storageId === id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTest = async () => {
    if (!storage) return;
    try {
      const res = await storageApi.test(storage);
      alert(res.success ? `Connected: ${res.message}` : `Failed: ${res.message}`);
    } catch (err: any) {
      alert(err.message || 'Connection test failed');
    }
  };

  const handleDelete = async () => {
    if (!storage || !confirm('Delete this storage configuration?')) return;
    await storageApi.delete(id);
    router.push('/storage');
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!storage) {
    return <p className="text-sm text-muted-foreground">Storage not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">{storage.label || storage.name}</h1>
            {storage.isDefault ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : null}
          </div>
          <p className="text-muted-foreground">{providerLabel(storage.provider)} — {storage.bucket}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => router.push('/storage')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" onClick={handleTest}>
            <Activity className="h-4 w-4" /> Test
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Provider</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{providerLabel(storage.provider)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Bucket</CardTitle></CardHeader>
          <CardContent className="truncate text-2xl font-semibold">{storage.bucket}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Jobs Using It</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{jobs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold capitalize">{storage.status}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>Jobs Using This Storage ({jobs.length})</CardTitle></CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No jobs are using this storage.</p>
            ) : (
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Database</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="max-w-[200px] truncate font-medium">{j.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{j.type}</Badge></TableCell>
                      <TableCell>{statusBadge(j.status)}</TableCell>
                      <TableCell className="text-sm">{j.databaseName}</TableCell>
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

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{storage.label ? 'Label' : 'Name'}</div>
                  <div className="text-muted-foreground">{storage.label || storage.name}</div>
                </div>
              </div>
              <DetailRow label="Provider" value={providerLabel(storage.provider)} />
              <DetailRow label="Endpoint" value={storage.endpoint} />
              <DetailRow label="Region" value={storage.region} />
              <DetailRow label="Bucket" value={storage.bucket} />
              <DetailRow label="Path Prefix" value={storage.pathPrefix} />
              <DetailRow label="Access Key" value={`${storage.accessKeyId.substring(0, 8)}...`} />
              <DetailRow label="Secret Key" value="••••••••" />
              <DetailRow label="Default" value={storage.isDefault ? 'Yes' : 'No'} />
              <DetailRow label="Created" value={formatDate(storage.createdAt)} />
              <DetailRow label="Updated" value={formatDate(storage.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Jobs</span>
                <span className="font-medium">{jobs.filter(j => j.status === 'running').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scheduled Jobs</span>
                <span className="font-medium">{jobs.filter(j => j.schedule).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">One-time Jobs</span>
                <span className="font-medium">{jobs.filter(j => !j.schedule).length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
