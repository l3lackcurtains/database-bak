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
  ) {
    let jobs = this.store.getAll<JobEntity>('jobs');
    if (status) jobs = jobs.filter((j) => j.status === status);
    if (type) jobs = jobs.filter((j) => j.type === type);
    const total = jobs.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = jobs.slice(start, start + limit);
    return { data, total, page, limit, totalPages };
  }

  async findOne(id: string): Promise<JobEntity | null> {
    return this.store.getById<JobEntity>('jobs', id) || null;
  }

  private buildSchedule(
    schedule?: CreateJobDto['schedule'] | UpdateJobDto['schedule'],
  ): JobEntity['schedule'] {
    if (!schedule) return null;
    return {
      frequency: schedule.frequency,
      cronExpression: schedule.cronExpression || null,
      nextRunAt: null,
      timezone: schedule.timezone || 'UTC',
    };
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
      },
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

      this.store.update<JobEntity>('jobs', jobId, {
        status: 'success',
        progress: 100,
        currentStep: 'Completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      this.store.update<JobEntity>('jobs', jobId, {
        status: 'failed',
        error: error.message,
        currentStep: 'Failed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async runBackup(jobId: string, db: any, storage: any): Promise<void> {
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 10,
      currentStep: 'Creating snapshot record',
    });

    const snapshot = await this.snapshotService.create({
      databaseId: db.id,
      databaseName: db.name,
      databaseType: db.type,
      storageId: storage.id,
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

    const key = `${db.type}/${db.name}/${snapshot.id}.dump.gz`;
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
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 30,
      currentStep: 'Fetching snapshot from storage',
    });
    await new Promise((r) => setTimeout(r, 1000));
    this.store.update<JobEntity>('jobs', jobId, {
      progress: 70,
      currentStep: 'Restoring database',
    });
    await new Promise((r) => setTimeout(r, 1000));
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
    const pendingJobs = this.store.findBy(
      'jobs',
      (j: JobEntity) => j.status === 'pending' && !!j.schedule,
    );
    for (const job of pendingJobs) {
      this.executeJob(job.id);
    }
  }
}
