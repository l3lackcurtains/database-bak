'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { jobsApi } from '@/lib/api-routes';
import type { BackupJob } from '@/types';
import { formatDate, formatDuration } from '@/lib/utils';
import { RefreshCw, Trash2, Pause, RotateCcw, Clock, Plus, Edit3, Play } from 'lucide-react';
import Link from 'next/link';

export function JobsPage() {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchJobs = useCallback(() => {
    jobsApi.list({ page, limit: 20 })
      .then((res) => {
        setJobs(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => {
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

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

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage backup, restore, and migration jobs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/jobs/new">
            <Button><Plus className="h-4 w-4" /> New Job</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Jobs</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No jobs yet. Create your first backup job.
            </p>
          ) : (
            <>
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Job</TableHead>
                    <TableHead className="w-[180px]">State</TableHead>
                    <TableHead className="w-[260px]">Run</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="max-w-[220px] truncate font-medium">{job.name}</div>
                          <div className="flex items-center gap-2">
                            {typeBadge(job.type)}
                            <span className="max-w-[150px] truncate text-xs text-muted-foreground" title={job.databaseName}>
                              {job.databaseName}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {statusBadge(job.status)}
                          <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={job.currentStep}>
                            {job.currentStep}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all ${
                                  job.status === 'failed'
                                    ? 'bg-destructive'
                                    : job.status === 'success'
                                      ? 'bg-success'
                                      : job.status === 'running'
                                        ? 'bg-primary'
                                        : 'bg-muted-foreground'
                                }`}
                                style={{ width: `${job.status === 'success' ? 100 : job.progress}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-xs text-muted-foreground">
                              {job.status === 'success' ? 100 : job.progress}%
                            </span>
                          </div>
                          {job.status === 'failed' && (
                            <div className="max-w-[260px] truncate text-xs text-destructive" title={job.error || undefined}>
                              {job.error || 'Failed'}
                            </div>
                          )}
                          {job.status === 'success' && job.startedAt && job.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(
                                new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {job.schedule ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span className="capitalize">{job.schedule.frequency}</span>
                              </span>
                            ) : (
                              <span>Once</span>
                            )}
                            <span>{formatDate(job.createdAt)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
