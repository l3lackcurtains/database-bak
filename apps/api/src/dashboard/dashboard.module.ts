import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
