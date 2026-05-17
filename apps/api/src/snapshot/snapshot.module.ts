import { Module } from '@nestjs/common';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';
import { StorageModule } from '../storage/storage.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, StorageModule],
  controllers: [SnapshotController],
  providers: [SnapshotService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
