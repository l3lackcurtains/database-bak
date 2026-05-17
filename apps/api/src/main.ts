import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function unauthorized(res: Response) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Crumet Sync", charset="UTF-8"');
  res.status(401).send('Authentication required');
}

function basicAuth(req: Request, res: Response, next: NextFunction) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!username || !password || req.method === 'OPTIONS') {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    unauthorized(res);
    return;
  }

  const credentials = Buffer.from(header.slice(6), 'base64')
    .toString('utf8')
  const separator = credentials.indexOf(':');

  if (separator === -1) {
    unauthorized(res);
    return;
  }

  const providedUsername = credentials.slice(0, separator);
  const providedPassword = credentials.slice(separator + 1);

  if (providedUsername !== username || providedPassword !== password) {
    unauthorized(res);
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
  app.use(basicAuth);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
