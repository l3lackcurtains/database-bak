import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { getUserFromRequest } from './session';

export function requireAdmin(req: Request): void {
  const current = getUserFromRequest(req);
  if (!current || current.role !== 'admin') {
    throw new ForbiddenException('Admin only');
  }
}
