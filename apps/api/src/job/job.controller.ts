import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto, UpdateJobDto } from './job.types';
import type { Request } from 'express';
import { getUserFromRequest } from '../auth/session';

@Controller('jobs')
export class JobController {
  constructor(private service: JobService) {}

  @Get()
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('databaseId') databaseId?: string,
    @Req() req: Request,
  ) {
    const user = getUserFromRequest(req)!;
    return this.service.findAll(parseInt(page), parseInt(limit), status, type, source, databaseId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.update(id, dto, user);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.cancel(id, user);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.retry(id, user);
  }

  @Post(':id/run')
  runNow(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.runNow(id, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    await this.service.remove(id, user);
    return { success: true };
  }

  @Post('cleanup-stuck')
  async cleanupStuck() {
    await this.service.cleanupStuckJobs();
    return { success: true, message: 'Cleanup completed' };
  }
}
