import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
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

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    if (!authConfigured()) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    if (!dto.username || dto.username !== process.env.DASHBOARD_USERNAME || dto.password !== process.env.DASHBOARD_PASSWORD) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const user = { username: dto.username, role: 'admin' as const };
    setSessionCookie(res, createSessionToken(user));
    return { user };
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
