import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AuthController, UsersController],
})
export class AuthModule {}
