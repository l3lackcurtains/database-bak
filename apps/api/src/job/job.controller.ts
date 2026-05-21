import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto, UpdateJobDto } from './job.types';

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
  ) {
    return this.service.findAll(parseInt(page), parseInt(limit), status, type, source, databaseId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  }

  @Post(':id/run')
  runNow(@Param('id') id: string) {
    return this.service.runNow(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
