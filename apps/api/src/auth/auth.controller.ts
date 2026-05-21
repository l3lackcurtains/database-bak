import { BadRequestException, Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { TursoStore } from '../common/turso.store';
import {
  authConfigured,
  clearSessionCookie,
  createSessionToken,
  getUserFromRequest,
  setSessionCookie,
} from './session';

type LoginDto = {
  username?: string;
  password?: string;
};

type ChangePasswordDto = {
  currentPassword: string;
  newPassword: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly store: TursoStore) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    if (!authConfigured()) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    if (!dto.username || !dto.password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const user = await this.store.findByUsername(dto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const authUser = { id: user.id, username: user.username, role: user.role };
    setSessionCookie(res, createSessionToken(authUser));
    return { user: authUser };
  }

  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const current = getUserFromRequest(req);
    if (!current) throw new UnauthorizedException('Not authenticated');

    if (!dto.currentPassword || !dto.newPassword) {
      throw new BadRequestException('Current and new password required');
    }
    if (dto.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    const user = await this.store.findByUsername(current.username);
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.store.update('users', current.id, { passwordHash: newHash } as any);

    const authUser = { id: user.id, username: user.username, role: user.role };
    setSessionCookie(res, createSessionToken(authUser));
    return { success: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { success: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = getUserFromRequest(req);
    if (!user) throw new UnauthorizedException('Not authenticated');
    return { user };
  }
}
