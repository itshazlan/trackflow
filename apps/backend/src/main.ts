import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './modules/auth/better-auth.config';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  // Ensure screenshots upload folder exists (Multer requires this)
  if (!fs.existsSync('./uploads/screenshots')) {
    fs.mkdirSync('./uploads/screenshots', { recursive: true });
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // 1. Mount Better Auth handler using a custom middleware to preserve req.url
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use((req: any, res: any, next: any) => {
    if (req.url.startsWith('/api/auth')) {
      console.log(`[Better Auth Middleware] Routing: ${req.method} ${req.url}`);
      return toNodeHandler(auth)(req, res);
    }
    next();
  });

  // 2. Apply body parsers globally for all subsequent NestJS routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve uploads folder static assets
  expressInstance.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads')),
  );

  // Register global validation pipe for request DTO validation
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
