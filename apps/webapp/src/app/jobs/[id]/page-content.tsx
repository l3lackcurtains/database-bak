'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarClock, Clock, Database, Edit3, HardDrive, Play, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { jobsApi } from '@/lib/api-routes';
import { formatBytes, formatDate, formatDuration } from '@/lib/utils';
import type { BackupJob, JobDatabaseDetails } from '@/types';

function statusBadge(status: string) {
  const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    success: 'success',
    failed: 'destructive',
    running: 'warning',
    pending: 'secondary',
    cancelled: 'secondary',
  };
  return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
}

function scheduleText(job: BackupJob) {
  const intervalLabels = (job.schedule?.intervalsHours?.length ? job.schedule.intervalsHours : job.schedule?.intervalHours ? [job.schedule.intervalHours] : [])
    .map((interval) => interval === 8 ? 'Three times a day' : `Every ${interval} hours`);
  const frequencies = job.schedule?.frequencies?.length ? job.schedule.frequencies : job.schedule ? [job.schedule.frequency] : [];
  const frequencyLabels = frequencies
    .filter((frequency) => frequency !== 'custom' && frequency !== 'once')
    .map((frequency) => frequency.charAt(0).toUpperCase() + frequency.slice(1));
  const labels = [...intervalLabels, ...frequencyLabels];
  if (!labels.length) return 'One-time run';
  return labels.join(', ');
}

function nextRunText(job: BackupJob) {
  if (job.status === 'running') return 'Running now';
  if (!job.schedule) return job.completedAt ? `Finished ${formatDate(job.completedAt)}` : 'Runs immediately';
  if (!job.schedule.nextRunAt) return 'Next run is being calculated';
  const diff = new Date(job.schedule.nextRunAt).getTime() - Date.now();
  return diff <= 0 ? 'Due now' : `Runs in ${formatDuration(diff)}`;
}

function databaseTarget(db: JobDatabaseDetails | null | undefined) {
  if (!db) return 'Unknown database';
  const displayName = db.label || db.name;
  return `${displayName} (${db.host || 'unknown'}${db.port ? `:${db.port}` : ''}/${db.database || db.name})`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[220px] break-all text-right font-medium">{value}</div>
    </div>
  );
}

export function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<BackupJob | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJob = useCallback(() => {
    jobsApi.get(id)
      .then(setJob)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchJob();
    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [fetchJob]);

  const handleRunNow = async () => {
    await jobsApi.runNow(id);
    fetchJob();
  };

  const handleRetry = async () => {
    await jobsApi.retry(id);
    fetchJob();
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!job) {
    return <p className="text-sm text-muted-foreground">Job not found.</p>;
  }

  const progress = job.status === 'success' ? 100 : job.progress;
  const retention = job.options.retention || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">{job.name}</h1>
            {statusBadge(job.status)}
          </div>
          <p className="text-muted-foreground">Job configuration, run state, and execution history</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => router.push('/jobs')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {job.schedule && (
            <Link href={`/jobs/${id}/edit`}>
              <Button variant="outline">
                <Edit3 className="h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
          {job.status !== 'running' && (
            <Button onClick={handleRunNow}>
              <Play className="h-4 w-4" /> Run Now
            </Button>
          )}
          {job.status === 'failed' && (
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Runs</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{job.runCount || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Failures</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{job.failedRunCount || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{progress}%</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Next</CardTitle></CardHeader>
          <CardContent className="text-sm font-medium">{nextRunText(job)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>Run State</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{job.currentStep}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {job.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {job.error}
              </div>
            )}
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Started</div>
                  <div className="text-muted-foreground">{formatDate(job.startedAt)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Completed</div>
                  <div className="text-muted-foreground">{formatDate(job.completedAt)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {job.type === 'restore' && (
          <Card>
            <CardHeader><CardTitle>Restore Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Database className="h-4 w-4 text-muted-foreground" /> Source
                  </div>
                  <DetailRow label="Name" value={(job.details?.sourceDatabase?.label || job.details?.sourceDatabase?.name) || job.details?.snapshot?.databaseName || 'Unknown'} />
                  <DetailRow label="Target" value={databaseTarget(job.details?.sourceDatabase)} />
                  <DetailRow label="Type" value={job.details?.sourceDatabase?.type || job.details?.snapshot?.databaseType || job.type} />
                  <DetailRow label="Snapshot" value={job.details?.snapshot?.id || job.options.snapshotId || 'Unknown'} />
                  {job.details?.snapshot?.metadata?.collections && (
                    <DetailRow label="Collections" value={job.details.snapshot.metadata.collections.length} />
                  )}
                </div>

                <div className="hidden pt-12 md:block">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Database className="h-4 w-4 text-muted-foreground" /> Destination
                  </div>
                  <DetailRow label="Name" value={job.details?.destinationDatabase?.label || job.details?.destinationDatabase?.name || job.databaseName} />
                  <DetailRow label="Target" value={databaseTarget(job.details?.destinationDatabase)} />
                  <DetailRow label="Type" value={job.details?.destinationDatabase?.type || job.type} />
                  <DetailRow label="Clean first" value={job.options.cleanBeforeRestore ? 'Yes' : 'No'} />
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <HardDrive className="h-4 w-4 text-muted-foreground" /> Storage
                </div>
                <DetailRow label="Name" value={job.details?.storage?.label || job.details?.storage?.name || job.storageId} />
                <DetailRow label="Bucket" value={job.details?.storage?.bucket || 'Unknown'} />
                <DetailRow label="Endpoint" value={job.details?.storage?.endpoint || 'Unknown'} />
                <DetailRow label="Object" value={job.details?.snapshot?.storageKey || 'Unknown'} />
                {job.details?.snapshot?.compressedSize !== undefined && (
                  <DetailRow label="Size" value={formatBytes(job.details.snapshot.compressedSize)} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Database</div>
                <div className="text-muted-foreground">{job.databaseName}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Storage ID</div>
                <div className="break-all text-muted-foreground">{job.storageId}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Schedule</div>
                <div className="text-muted-foreground">{scheduleText(job)}</div>
                {job.schedule?.nextRunAt && (
                  <div className="text-muted-foreground">{formatDate(job.schedule.nextRunAt)}</div>
                )}
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="mb-2 font-medium">Retention</div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Hourly: {retention.hourly ?? 0}</span>
                <span>Daily: {retention.daily ?? 0}</span>
                <span>Weekly: {retention.weekly ?? 0}</span>
                <span>Monthly: {retention.monthly ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
