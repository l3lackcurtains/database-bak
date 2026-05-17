import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JsonStore } from '../common/json.store';
import { JobEntity } from '../entities/job.entity';
import { CreateJobDto, UpdateJobDto } from './job.types';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { SnapshotService } from '../snapshot/snapshot.service';
import { BackupEngine } from '../backup-engine/backup.engine';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private store: JsonStore,
    private databaseService: DatabaseService,
    private storageService: StorageService,
    private snapshotService: SnapshotService,
    private backupEngine: BackupEngine,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: string,
    type?: string,
    source?: string,
  ) {
    this.ensureScheduledJobsHaveNextRun();
    let jobs = this.store.getAll<JobEntity>('jobs');
    if (status) jobs = jobs.filter((j) => j.status === status);
    if (type) jobs = jobs.filter((j) => j.type === type);
    if (source === 'manual') {
      jobs = jobs.filter((j) => !j.schedule);
    } else if (source === 'scheduled') {
      jobs = jobs.filter((j) => !!j.schedule);
    }
    const total = jobs.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = jobs.slice(start, start + limit).map((job) => this.withDetails(job));
    return { data, total, page, limit, totalPages };
  }

  async findOne(id: string): Promise<JobEntity | null> {
    this.ensureScheduledJobsHaveNextRun();
    const job = this.store.getById<JobEntity>('jobs', id) || null;
    return job ? this.withDetails(job) : null;
  }

  private databaseSummary(id?: string | null) {
    if (!id) return null;
    const db = this.store.getById<any>('databases', id);
    if (!db) return null;
    return {
      id: db.id,
      name: db.name,
      type: db.type,
      host: db.host,
      port: db.port,
      database: db.database,
      username: db.username,
      ssl: db.ssl,
      url: db.url ? db.url.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@') : undefined,
    };
  }

  private storageSummary(id?: string | null) {
    if (!id) return null;
    const storage = this.store.getById<any>('storage', id);
    if (!storage) return null;
    return {
      id: storage.id,
      name: storage.name,
      provider: storage.provider,
      endpoint: storage.endpoint,
      region: storage.region,
      bucket: storage.bucket,
      pathPrefix: storage.pathPrefix,
    };
  }

  private withDetails(job: JobEntity): JobEntity {
    const snapshotId = job.options?.snapshotId || job.snapshotId;
    const snapshot = snapshotId ? this.store.getById<any>('snapshots', snapshotId) : null;
    const sourceDatabase = snapshot
      ? this.databaseSummary(snapshot.databaseId) || {
          id: snapshot.databaseId,
          name: snapshot.databaseName,
          type: snapshot.databaseType,
          database: snapshot.metadata?.database,
        }
      : this.databaseSummary(job.databaseId);
    const destinationDatabase = job.type === 'restore'
      ? this.databaseSummary(job.options?.targetDatabaseId || job.databaseId)
      : null;

    return {
      ...job,
      details: {
        sourceDatabase,
        destinationDatabase,
        storage: this.storageSummary(job.storageId),
        snapshot: snapshot
          ? {
              id: snapshot.id,
              databaseName: snapshot.databaseName,
              databaseType: snapshot.databaseType,
              storageKey: snapshot.storageKey,
              size: snapshot.size,
              compressedSize: snapshot.compressedSize,
              checksum: snapshot.checksum,
              createdAt: snapshot.createdAt,
              completedAt: snapshot.completedAt,
              metadata: snapshot.metadata,
            }
          : null,
      },
    } as JobEntity;
  }

  private nextRunFrom(
    schedule: JobEntity['schedule'],
    from: Date = new Date(),
  ): string | null {
    if (!schedule) return null;
    const intervalCandidates = (schedule.intervalsHours?.length ? schedule.intervalsHours : schedule.intervalHours ? [schedule.intervalHours] : [])
      .filter((interval) => interval > 0)
      .map((interval) => new Date(from.getTime() + interval * 60 * 60 * 1000).toISOString());
    const frequencies = schedule.frequencies?.length ? schedule.frequencies : [schedule.frequency];
    const candidates = frequencies
      .map((frequency) => this.nextRunForFrequency(frequency, from))
      .filter(Boolean) as string[];

    const allCandidates = [...intervalCandidates, ...candidates];
    if (allCandidates.length === 0) return null;
    return allCandidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  }

  private nextRunForFrequency(
    frequency: NonNullable<JobEntity['schedule']>['frequency'],
    from: Date,
  ): string | null {
    const next = new Date(from);

    if (frequency === 'hourly') {
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else if (frequency === 'daily') {
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
    } else if (frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
      next.setHours(2, 0, 0, 0);
    } else if (frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(2, 0, 0, 0);
    } else {
      return null;
    }

    return next.toISOString();
  }

  private scheduleWithNextRun(
    schedule?: CreateJobDto['schedule'] | UpdateJobDto['schedule'],
    from: Date = new Date(),
  ): JobEntity['schedule'] {
    if (!schedule) return null;
    const frequencies = schedule.frequencies?.filter((frequency) => frequency !== 'once' && frequency !== 'custom') || [];
    const primaryFrequency = frequencies[0] || schedule.frequency;
    const base = {
      frequency: primaryFrequency,
      frequencies: frequencies.length ? frequencies : undefined,
      intervalHours: schedule.intervalHours,
      intervalsHours: schedule.intervalsHours,
      cronExpression: schedule.cronExpression || null,
      nextRunAt: null,
      timezone: schedule.timezone || 'UTC',
    };
    return {
      ...base,
      nextRunAt: this.nextRunFrom(base, from),
    };
  }

  private scheduleSlug(schedule: JobEntity['schedule']): string {
    if (!schedule) return 'manual';
    const intervalSlugs = (schedule.intervalsHours?.length ? schedule.intervalsHours : schedule.intervalHours ? [schedule.intervalHours] : [])
      .map((interval) => `every-${interval}-hours`);
    const frequencySlugs = (schedule.frequencies?.length ? schedule.frequencies : [schedule.frequency])
      .filter((frequency) => frequency !== 'once' && frequency !== 'custom');
    const slug = [...intervalSlugs, ...frequencySlugs].join('-');
    return slug || 'scheduled';
  }

  private ensureScheduledJobsHaveNextRun() {
    const jobs = this.store.getAll<JobEntity>('jobs');
    for (const job of jobs) {
      if (!job.schedule || job.schedule.nextRunAt || job.status === 'running' || job.status === 'cancelled') continue;
      const nextRunAt = this.nextRunFrom(job.schedule, new Date(job.completedAt || job.createdAt));
      if (nextRunAt) {
        this.store.update<JobEntity>('jobs', job.id, {
          schedule: { ...job.schedule, nextRunAt },
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private buildSchedule(
    schedule?: CreateJobDto['schedule'] | UpdateJobDto['schedule'],
  ): JobEntity['schedule'] {
    return this.scheduleWithNextRun(schedule);
  }

  async create(dto: CreateJobDto): Promise<JobEntity> {
    const db = await this.databaseService.findOne(dto.databaseId);
    if (!db) throw new Error('Database not found');

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    const entity: JobEntity = {
      id,
      name: dto.name,
      databaseId: dto.databaseId,
      databaseName: db.name,
      storageId: dto.storageId,
      type: dto.type,
      status: 'pending',
      schedule: this.buildSchedule(dto.schedule),
      options: {
        compress: dto.options?.compress ?? true,
        encrypt: dto.options?.encrypt ?? false,
        targetDatabaseId: dto.options?.targetDatabaseId,
        snapshotId: dto.options?.snapshotId,
        cleanBeforeRestore: dto.options?.cleanBeforeRestore ?? false,
        retention: dto.options?.retention,
      },
      runCount: 0,
      failedRunCount: 0,
      progress: 0,
      currentStep: 'Queued',
      snapshotId: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const job = this.store.create('jobs', entity);

    if (dto.schedule?.frequency === 'once' || !dto.schedule) {
      this.executeJob(job.id);
    }

    return job;
  }

  async update(id: string, dto: UpdateJobDto): Promise<JobEntity | null> {
    const existing = await this.findOne(id);
    if (!existing || existing.status === 'running') return null;

    let databaseName = existing.databaseName;
    if (dto.databaseId && dto.databaseId !== existing.databaseId) {
      const db = await this.databaseService.findOne(dto.databaseId);
      if (!db) throw new BadRequestException('Database not found');
      databaseName = db.name;
    }

    if (dto.storageId && dto.storageId !== existing.storageId) {
      const storage = await this.storageService.findOne(dto.storageId);
      if (!storage) throw new BadRequestException('Storage not found');
    }

    return this.store.update<JobEntity>('jobs', id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.databaseId !== undefined ? { databaseId: dto.databaseId, databaseName } : {}),
      ...(dto.storageId !== undefined ? { storageId: dto.storageId } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.schedule !== undefined ? { schedule: this.buildSchedule(dto.schedule) } : {}),
      ...(dto.options !== undefined
        ? {
            options: {
              ...existing.options,
              compress: dto.options.compress ?? existing.options.compress,
              encrypt: dto.options.encrypt ?? existing.options.encrypt,
              targetDatabaseId: dto.options.targetDatabaseId,
              snapshotId: dto.options.snapshotId ?? existing.options.snapshotId,
              cleanBeforeRestore: dto.options.cleanBeforeRestore ?? existing.options.cleanBeforeRestore,
              retention: dto.options.retention ?? existing.options.retention,
            },
          }
        : {}),
      status: existing.status === 'failed' || existing.status === 'cancelled' ? 'pending' : existing.status,
      progress: 0,
      currentStep: 'Updated',
      error: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async cancel(id: string): Promise<JobEntity | null> {
    const job = await this.findOne(id);
    if (!job || job.status !== 'running') return null;
    return this.store.update<JobEntity>('jobs', id, {
      status: 'cancelled',
      currentStep: 'Cancelled',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async retry(id: string): Promise<JobEntity | null> {
    const job = await this.findOne(id);
    if (!job || job.status !== 'failed') return null;
    this.store.update<JobEntity>('jobs', id, {
      status: 'pending',
      progress: 0,
      currentStep: 'Retrying',
      error: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    });
    this.executeJob(id);
    return this.findOne(id);
  }

  async runNow(id: string): Promise<JobEntity | null> {
    const job = await this.findOne(id);
    if (!job || job.status === 'running') return null;

    this.store.update<JobEntity>('jobs', id, {
      status: 'pending',
      progress: 0,
      currentStep: 'Queued',
      error: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    });
    this.executeJob(id);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    this.store.delete('jobs', id);
  }

  async executeJob(jobId: string): Promise<void> {
    const job = await this.findOne(jobId);
    if (!job) return;

    this.store.update<JobEntity>('jobs', jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
      currentStep: 'Starting',
      runCount: (job.runCount || 0) + 1,
      ...(job.schedule ? { schedule: { ...job.schedule, nextRunAt: null } } : {}),
      updatedAt: new Date().toISOString(),
    });

    try {
      const db = await this.databaseService.findOne(job.databaseId);
      const storage = await this.storageService.findOne(job.storageId);
      if (!db) {
        throw new Error(`Database not found: ${job.databaseId}. Select an existing database or recreate this job.`);
      }
      if (!storage) {
        throw new Error(`Storage not found: ${job.storageId}. Select an existing storage configuration or recreate this job.`);
      }

      this.logger.log(`Executing ${job.type} job: ${job.name}`);

      if (job.type === 'backup') {
        await this.runBackup(jobId, db, storage);
      } else if (job.type === 'restore') {
        await this.runRestore(jobId, db, storage);
      } else if (job.type === 'migrate') {
        await this.runMigrate(jobId, db, storage);
      }

      const completedAt = new Date();
      const latestJob = await this.findOne(jobId);
      this.store.update<JobEntity>('jobs', jobId, {
        status: 'success',
        progress: 100,
        currentStep: 'Completed',
        completedAt: completedAt.toISOString(),
        ...(latestJob?.schedule
          ? { schedule: { ...latestJob.schedule, nextRunAt: this.nextRunFrom(latestJob.schedule, completedAt) } }
          : {}),
        updatedAt: completedAt.toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      const failedJob = await this.findOne(jobId);
      if (failedJob?.snapshotId) {
        await this.snapshotService.update(failedJob.snapshotId, {
          status: 'failed',
          error: error.message,
          completedAt: new Date().toISOString(),
        });
      }
      const failedAt = new Date();
      const latestJob = await this.findOne(jobId);
      this.store.update<JobEntity>('jobs', jobId, {
        status: 'failed',
        error: error.message,
        currentStep: 'Failed',
        completedAt: failedAt.toISOString(),
        failedRunCount: (latestJob?.failedRunCount || 0) + 1,
        ...(latestJob?.schedule
          ? { schedule: { ...latestJob.schedule, nextRunAt: this.nextRunFrom(latestJob.schedule, failedAt) } }
          : {}),
        updatedAt: failedAt.toISOString(),
      });
    }
  }

  private async runBackup(jobId: string, db: any, storage: any): Promise<void> {
    const job = await this.findOne(jobId);
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 10,
      currentStep: 'Creating snapshot record',
    });

    const snapshot = await this.snapshotService.create({
      databaseId: db.id,
      databaseName: db.name,
      databaseType: db.type,
      storageId: storage.id,
      sourceType: job?.schedule ? 'scheduled' : 'manual',
      sourceJobId: jobId,
      sourceJobName: job?.name,
    });

    this.store.update<JobEntity>('jobs', jobId, {
      snapshotId: snapshot.id,
      progress: 20,
      currentStep: 'Dumping database',
    });

    const dumpResult = await this.backupEngine.dumpDatabase(db);

    this.store.update<JobEntity>('jobs', jobId, {
      progress: 60,
      currentStep: 'Uploading to storage',
    });

    const timestamp = new Date(snapshot.startedAt).toISOString().replace(/[:.]/g, '-');
    const safeDatabaseName = String(db.name || db.database || 'database')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'database';
    const scheduleSlug = this.scheduleSlug(job?.schedule || null);
    const key = `${db.type}/${safeDatabaseName}/${safeDatabaseName}-${scheduleSlug}-${timestamp}-${snapshot.id}.dump.gz`;
    const uploadResult = await this.storageService.uploadFile(
      storage,
      key,
      dumpResult.data,
    );

    this.store.update<JobEntity>('jobs', jobId, {
      progress: 90,
      currentStep: 'Finalizing',
    });

    await this.snapshotService.update(snapshot.id, {
      storageKey: uploadResult.key,
      size: dumpResult.size,
      compressedSize: uploadResult.size,
      checksum: dumpResult.checksum,
      status: 'completed',
      completedAt: new Date().toISOString(),
      metadata: {
        version: dumpResult.metadata.version || '1.0',
        ...dumpResult.metadata,
      },
    });
  }

  private async runRestore(
    jobId: string,
    db: any,
    storage: any,
  ): Promise<void> {
    const job = await this.findOne(jobId);
    const snapshotId = job?.options?.snapshotId;
    if (!snapshotId) {
      throw new Error('Snapshot not selected for restore');
    }

    const snapshot = await this.snapshotService.findOne(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    if (snapshot.status !== 'completed') {
      throw new Error(`Snapshot is not ready to restore: ${snapshot.status}`);
    }

    this.store.update<JobEntity>('jobs', jobId, {
      progress: 30,
      currentStep: 'Fetching snapshot from storage',
    });
    const archive = await this.storageService.downloadFile(storage, snapshot.storageKey);

    this.store.update<JobEntity>('jobs', jobId, {
      progress: 70,
      currentStep: 'Restoring database',
    });
    await this.backupEngine.restoreDatabase(db, snapshot, archive, {
      cleanBeforeRestore: job.options?.cleanBeforeRestore,
    });

    this.store.update<JobEntity>('jobs', jobId, {
      progress: 95,
      currentStep: 'Verifying restore',
    });
  }

  private async runMigrate(
    jobId: string,
    db: any,
    storage: any,
  ): Promise<void> {
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 10,
      currentStep: 'Creating backup of source',
    });
    await this.runBackup(jobId, db, storage);
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 50,
      currentStep: 'Restoring to target',
    });
    await new Promise((r) => setTimeout(r, 2000));
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 90,
      currentStep: 'Verifying migration',
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledJobs() {
    this.ensureScheduledJobsHaveNextRun();
    const now = Date.now();
    const pendingJobs = this.store.findBy(
      'jobs',
      (j: JobEntity) =>
        !!j.schedule?.nextRunAt &&
        j.status !== 'running' &&
        j.status !== 'cancelled' &&
        new Date(j.schedule.nextRunAt).getTime() <= now,
    );
    for (const job of pendingJobs) {
      this.executeJob(job.id);
    }
  }
}
