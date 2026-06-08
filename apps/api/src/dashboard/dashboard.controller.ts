import { Controller, Get, Req } from '@nestjs/common';
import { TursoStore } from '../common/turso.store';
import { JobEntity } from '../entities/job.entity';
import { SnapshotEntity } from '../entities/snapshot.entity';
import type { Request } from 'express';
import { getUserFromRequest } from '../auth/session';

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
  constructor(private store: TursoStore) {}

  @Get('stats')
  async getStats(@Req() req: Request): Promise<DashboardStats> {
    const user = getUserFromRequest(req)!;
    
    let jobs = await this.store.getAll<JobEntity>('jobs');
    let snapshots = await this.store.getAll<SnapshotEntity>('snapshots');
    let databases = await this.store.getAll<any>('databases');

    if (user && user.role !== 'admin') {
      jobs = jobs.filter((j: any) => j.userId === user.id || !j.userId);
      snapshots = snapshots.filter((s: any) => s.userId === user.id || !s.userId);
      databases = databases.filter((db: any) => db.userId === user.id || !db.userId);
    }

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
      totalDatabases: databases.length,
      totalSnapshots: snapshots.length,
      totalStorageUsed,
      activeJobs,
      successfulBackups24h,
      failedBackups24h,
      nextScheduledRun: nextScheduled?.createdAt?.toString() || null,
    };
  }
}
