import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto, UpdateDatabaseDto } from './database.types';

@Controller('databases')
export class DatabaseController {
  constructor(private service: DatabaseService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDatabaseDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDatabaseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

  @Post('test')
  testConnection(@Body() dto: CreateDatabaseDto) {
    return this.service.testConnection(dto);
  }
}
