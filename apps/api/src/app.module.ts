import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { JobModule } from './job/job.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    DatabaseModule,
    StorageModule,
    SnapshotModule,
    JobModule,
    DashboardModule,
  ],
})
export class AppModule {}
