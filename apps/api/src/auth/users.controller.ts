import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { TursoStore } from '../common/turso.store';
import { getUserFromRequest } from './session';
import { requireAdmin } from './require-admin';

type CreateUserDto = {
  username: string;
  password: string;
  role?: string;
};

type UpdateUserDto = {
  username?: string;
  password?: string;
  role?: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly store: TursoStore) {}

  @Get()
  async list(@Req() req: Request) {
    requireAdmin(req);
    const users = await this.store.getAll<any>('users');
    return users.map((u: any) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt }));
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request) {
    requireAdmin(req);
    const user = await this.store.getById<any>('users', id);
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: Request) {
    requireAdmin(req);
    if (!dto.username || !dto.password) throw new BadRequestException('Username and password required');

    const existing = await this.store.findByUsername(dto.username);
    if (existing) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const now = new Date().toISOString();
    const user = {
      id: uuid(),
      username: dto.username,
      passwordHash,
      role: dto.role || 'admin',
      createdAt: now,
      updatedAt: now,
    };

    await this.store.create('users', user);
    return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    requireAdmin(req);

    const existing = await this.store.getById<any>('users', id);
    if (!existing) throw new NotFoundException('User not found');

    if (dto.username && dto.username !== existing.username) {
      const dup = await this.store.findByUsername(dto.username);
      if (dup) throw new ConflictException('Username already exists');
    }

    const updates: any = {};
    if (dto.username) updates.username = dto.username;
    if (dto.role) updates.role = dto.role;
    if (dto.password) updates.passwordHash = await bcrypt.hash(dto.password, 10);

    await this.store.update('users', id, updates);
    const updated = await this.store.getById<any>('users', id);
    return { id: updated.id, username: updated.username, role: updated.role, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    requireAdmin(req);

    const user = await this.store.getById<any>('users', id);
    if (!user) throw new NotFoundException('User not found');

    const current = getUserFromRequest(req)!;
    if (user.id === current.id) throw new BadRequestException('Cannot delete yourself');

    if (user.role === 'admin') {
      const admins = (await this.store.getAll<any>('users')).filter((u: any) => u.role === 'admin');
      if (admins.length <= 1) throw new BadRequestException('Cannot delete the only admin user');
    }

    await this.store.delete('users', id);
    return { success: true };
  }
}
