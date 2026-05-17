'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { jobsApi } from '@/lib/api-routes';
import type { BackupJob } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';
import { CalendarClock, Clock, Database, Edit3, Pause, Play, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';

type JobsTab = 'scheduled' | 'manual';

export function JobsPage() {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [now, setNow] = useState(0);
  const [activeTab, setActiveTab] = useState<JobsTab>('scheduled');

  const fetchJobs = useCallback(() => {
    jobsApi.list({ page, limit: 20, source: activeTab })
      .then((res) => {
        setJobs(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => {
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (id: string) => {
    await jobsApi.cancel(id);
    fetchJobs();
  };

  const handleRetry = async (id: string) => {
    await jobsApi.retry(id);
    fetchJobs();
  };

  const handleRunNow = async (id: string) => {
    await jobsApi.runNow(id);
    fetchJobs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job record?')) return;
    await jobsApi.delete(id);
    fetchJobs();
  };

  const handleTabChange = (tab: JobsTab) => {
    setLoading(true);
    setActiveTab(tab);
    setPage(1);
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
      success: 'success', completed: 'success', failed: 'destructive',
      running: 'warning', pending: 'secondary', cancelled: 'secondary',
    };
    return <Badge variant={variants[status] ?? 'secondary'} className="capitalize">{status}</Badge>;
  };

  const typeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'info' | 'warning'> = {
      backup: 'default', restore: 'info', migrate: 'warning',
    };
    return <Badge variant={variants[type] ?? 'secondary'} className="capitalize">{type}</Badge>;
  };

  const scheduleLabel = (job: BackupJob) => {
    if (!job.schedule) return 'One-time run';
    const intervalLabels = (job.schedule.intervalsHours?.length ? job.schedule.intervalsHours : job.schedule.intervalHours ? [job.schedule.intervalHours] : [])
      .map((interval) => interval === 8 ? 'Three times a day' : `Every ${interval} hours`);
    const frequencies = job.schedule.frequencies?.length ? job.schedule.frequencies : [job.schedule.frequency];
    const frequencyLabels = frequencies
      .filter((frequency) => frequency !== 'custom' && frequency !== 'once')
      .map((frequency) => frequency.charAt(0).toUpperCase() + frequency.slice(1));
    return [...intervalLabels, ...frequencyLabels].join(', ') || 'Scheduled';
  };

  const nextRunLabel = (job: BackupJob) => {
    if (job.status === 'running') return 'Running now';
    if (!job.schedule) return job.completedAt ? `Finished ${formatDate(job.completedAt)}` : 'Runs immediately';
    if (!job.schedule.nextRunAt) return 'Next run is being calculated';
    if (!now) return formatDate(job.schedule.nextRunAt);

    const diff = new Date(job.schedule.nextRunAt).getTime() - now;
    if (diff <= 0) return 'Due now';
    return `Runs in ${formatDuration(diff)}`;
  };

  const progressValue = (job: BackupJob) => (job.status === 'success' ? 100 : job.progress);

  const progressClass = (job: BackupJob) => {
    if (job.status === 'failed') return 'bg-destructive';
    if (job.status === 'success') return 'bg-success';
    if (job.status === 'running') return 'bg-primary';
    return 'bg-muted-foreground';
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup Jobs</h1>
          <p className="text-muted-foreground">Monitor scheduled work separately from one-time manual runs</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/jobs/manual">
            <Button><Play className="h-4 w-4" /> Manual Backup</Button>
          </Link>
          <Link href="/jobs/new">
            <Button variant="outline"><Plus className="h-4 w-4" /> Scheduled Job</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>{activeTab === 'manual' ? 'Manual runs' : 'Jobs'}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'scheduled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTabChange('scheduled')}
            >
              Scheduled & active jobs
            </Button>
            <Button
              variant={activeTab === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTabChange('manual')}
            >
              Manual runs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {activeTab === 'manual'
                ? 'No manual backup runs yet. Run a manual backup to see it here.'
                : 'No scheduled jobs yet. Create your first backup job.'}
            </p>
          ) : (
            <>
              <div className="grid gap-3 xl:grid-cols-2">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-md border bg-card p-4 shadow-aurora-sm">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/jobs/${job.id}`} className="min-w-0 max-w-full truncate text-sm font-semibold hover:text-primary">
                            {job.name}
                          </Link>
                          {typeBadge(job.type)}
                          {statusBadge(job.status)}
                        </div>

                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                              <Database className="h-3.5 w-3.5" /> Database
                            </div>
                            <div className="truncate" title={job.databaseName}>{job.databaseName}</div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                              <CalendarClock className="h-3.5 w-3.5" /> Schedule
                            </div>
                            <div>{scheduleLabel(job)}</div>
                            {job.schedule?.nextRunAt && (
                              <div className="text-xs text-muted-foreground">{formatDate(job.schedule.nextRunAt)}</div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> Next
                            </div>
                            <div className={job.status === 'running' || nextRunLabel(job) === 'Due now' ? 'font-medium text-primary' : ''}>
                              {nextRunLabel(job)}
                            </div>
                            {job.startedAt && job.completedAt && (
                              <div className="text-xs text-muted-foreground">
                                Last run took {formatDuration(new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime())}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-medium uppercase text-muted-foreground">History</div>
                            <div>{job.runCount || 0} runs</div>
                            <div className="text-xs text-muted-foreground">{job.failedRunCount || 0} failed</div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="max-w-[240px] truncate" title={job.currentStep}>{job.currentStep}</span>
                            <span>{progressValue(job)}%</span>
                          </div>
                          <div className="h-1.5 max-w-[240px] overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full transition-all ${progressClass(job)}`}
                              style={{ width: `${progressValue(job)}%` }}
                            />
                          </div>
                          {job.status === 'failed' && (
                            <div className="truncate text-xs text-destructive" title={job.error || undefined}>
                              {job.error || 'Failed'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 justify-end gap-1 border-t pt-3">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="outline" size="sm">Details</Button>
                        </Link>
                        {job.status === 'running' && (
                          <Button variant="ghost" size="icon" onClick={() => handleCancel(job.id)} title="Cancel">
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status !== 'running' && (
                          <Button variant="ghost" size="icon" onClick={() => handleRunNow(job.id)} title="Run now">
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button variant="ghost" size="icon" onClick={() => handleRetry(job.id)} title="Retry">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status !== 'running' && (
                          <Link href={`/jobs/${job.id}/edit`}>
                            <Button variant="ghost" size="icon" title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
