import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { CreateStorageDto, UpdateStorageDto } from './storage.types';

@Controller('storage')
export class StorageController {
  constructor(private service: StorageService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStorageDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStorageDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string) {
    return this.service.setDefault(id);
  }

  @Post('test')
  testConnection(@Body() dto: CreateStorageDto) {
    return this.service.testConnection(dto);
  }
}
