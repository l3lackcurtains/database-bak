import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobProcessor } from './job.processor';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { BackupEngine } from '../backup-engine/backup.engine';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule, 
    DatabaseModule, 
    StorageModule, 
    SnapshotModule,
    BullModule.registerQueue({
      name: 'jobs',
    })
  ],
  controllers: [JobController],
  providers: [JobService, JobProcessor, BackupEngine],
  exports: [JobService],
})
export class JobModule {}
