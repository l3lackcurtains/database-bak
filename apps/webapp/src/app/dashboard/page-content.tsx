'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { dashboardApi, jobsApi, snapshotsApi } from '@/lib/api-routes';
import type { DashboardStats, BackupJob, Snapshot } from '@/types';
import { formatBytes, formatDate } from '@/lib/utils';
import {
  Database,
  HardDrive,
  ArrowUpCircle,
  AlertCircle,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<BackupJob[]>([]);
  const [recentSnapshots, setRecentSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.stats(),
      jobsApi.list({ limit: 5 }),
      snapshotsApi.list({ limit: 5 }),
    ])
      .then(([statsRes, jobsRes, snapshotsRes]) => {
        setStats(statsRes);
        setRecentJobs(jobsRes.data);
        setRecentSnapshots(snapshotsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Databases',
      value: stats?.totalDatabases ?? 0,
      icon: Database,
      color: 'text-info',
      href: '/databases',
    },
    {
      title: 'Snapshots',
      value: stats?.totalSnapshots ?? 0,
      icon: HardDrive,
      color: 'text-primary',
      href: '/snapshots',
    },
    {
      title: 'Storage Used',
      value: formatBytes(stats?.totalStorageUsed ?? 0),
      icon: ArrowUpCircle,
      color: 'text-success',
      href: '/storage',
    },
    {
      title: 'Active Jobs',
      value: stats?.activeJobs ?? 0,
      icon: Clock,
      color: 'text-warning',
      href: '/jobs',
    },
  ];

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'secondary'> = {
      success: 'success',
      completed: 'success',
      failed: 'destructive',
      running: 'warning',
      pending: 'secondary',
      creating: 'warning',
      cancelled: 'secondary',
    };
    return (
      <Badge variant={variants[status] ?? 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your database backups and sync operations
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/jobs/manual">
            <Button>
              <Play className="h-4 w-4" />
              Manual Backup
            </Button>
          </Link>
          <Link href="/jobs/new">
            <Button variant="outline">
              <Clock className="h-4 w-4" />
              Scheduled Job
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-aurora-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet</p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{job.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {job.type} for {job.databaseName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(job.status)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Snapshots</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSnapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots yet</p>
            ) : (
              <div className="space-y-3">
                {recentSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{snapshot.databaseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(snapshot.compressedSize)} &middot;{' '}
                        {snapshot.databaseType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(snapshot.status)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(snapshot.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats?.failedBackups24h && stats.failedBackups24h > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {stats.failedBackups24h} failed backup(s) in the last 24 hours
              </p>
              <Link href="/jobs?status=failed" className="text-sm text-destructive underline">
                View failed jobs
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
