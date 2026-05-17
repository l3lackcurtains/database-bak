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

  if (!getUserFromRequest(req)) {
    res.status(401).json({ message: 'Authentication required', statusCode: 401, error: 'Unauthorized' });
    return;
  }

  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:7100',
      'http://127.0.0.1:7100',
      'http://localhost:7101',
      'http://127.0.0.1:7101',
      'http://192.168.0.84:7100',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(sessionAuth);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
