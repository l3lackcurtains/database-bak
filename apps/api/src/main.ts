import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { authConfigured, getUserFromRequest } from './auth/session';

function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const path = req.path.replace(/^\/api/, '');

  if (!authConfigured() || req.method === 'OPTIONS' || path === '/auth/login') {
    next();
    return;
  }

  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Authentication required', statusCode: 401, error: 'Unauthorized' });
    return;
  }

  // Enforce roles:
  // If the user's role is 'viewer', they can only make 'GET' requests.
  // Exception: 'POST /auth/logout', 'POST /auth/change-password'.
  if (user.role === 'viewer' && req.method !== 'GET') {
    const isSelfServiceAuth = path === '/auth/logout' || path === '/auth/change-password';
    if (!isSelfServiceAuth) {
      res.status(403).json({ message: 'Forbidden resource: Viewers have read-only access', statusCode: 403, error: 'Forbidden' });
      return;
    }
  }

  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:7300',
      'http://127.0.0.1:7300',
      'http://localhost:7301',
      'http://127.0.0.1:7301',
      'http://localhost:7302',
      'http://127.0.0.1:7302',
      'http://192.168.0.84:7300',
      'https://bak.nepalacts.com',
      'http://bak.nepalacts.com',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(sessionAuth);

  const port = process.env.PORT || 7301;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
