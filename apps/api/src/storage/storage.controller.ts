import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { CreateStorageDto, UpdateStorageDto } from './storage.types';
import type { Request } from 'express';
import { getUserFromRequest } from '../auth/session';

@Controller('storage')
export class StorageController {
  constructor(private service: StorageService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateStorageDto, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStorageDto, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    await this.service.remove(id, user);
    return { success: true };
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string, @Req() req: Request) {
    const user = getUserFromRequest(req)!;
    return this.service.setDefault(id, user);
  }

  @Post('test')
  testConnection(@Body() dto: CreateStorageDto) {
    return this.service.testConnection(dto);
  }
}
