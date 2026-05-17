import { Controller, Get } from '@nestjs/common';
import { JsonStore } from '../common/json.store';
import { JobEntity } from '../entities/job.entity';
import { SnapshotEntity } from '../entities/snapshot.entity';

interface DashboardStats {
  totalDatabases: number;
  totalSnapshots: number;
  totalStorageUsed: number;
  activeJobs: number;
  successfulBackups24h: number;
  failedBackups24h: number;
  nextScheduledRun: string | null;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private store: JsonStore) {}

  @Get('stats')
  async getStats(): Promise<DashboardStats> {
    const jobs = this.store.getAll<JobEntity>('jobs');
    const snapshots = this.store.getAll<SnapshotEntity>('snapshots');
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const activeJobs = jobs.filter((j) => j.status === 'running').length;
    const successfulBackups24h = jobs.filter(
      (j) =>
        j.status === 'success' &&
        j.completedAt &&
        new Date(j.completedAt) > twentyFourHoursAgo,
    ).length;
    const failedBackups24h = jobs.filter(
      (j) =>
        j.status === 'failed' &&
        j.completedAt &&
        new Date(j.completedAt) > twentyFourHoursAgo,
    ).length;

    const nextScheduled = jobs
      .filter((j) => j.schedule && j.status === 'pending')
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];

    const totalStorageUsed = snapshots.reduce(
      (sum, s) => sum + (s.compressedSize || 0),
      0,
    );

    return {
      totalDatabases: this.store.count('databases'),
      totalSnapshots: snapshots.length,
      totalStorageUsed,
      activeJobs,
      successfulBackups24h,
      failedBackups24h,
      nextScheduledRun: nextScheduled?.createdAt?.toString() || null,
    };
  }
}
