import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { BackupEngine } from '../backup-engine/backup.engine';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, DatabaseModule, StorageModule, SnapshotModule],
  controllers: [JobController],
  providers: [JobService, BackupEngine],
  exports: [JobService],
})
export class JobModule {}
