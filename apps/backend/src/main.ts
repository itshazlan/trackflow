import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './modules/auth/better-auth.config';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { R2Service } from './modules/time-tracking/r2.service';

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

  // Mount mock-r2 handler for local file upload testing
  expressInstance.put('/mock-r2/:bucket/:key*', (req: any, res: any) => {
    const key = req.params.key; // e.g. avatars/xxx.png or project/xxx/screenshots/xxx.webp
    const filePath = join(process.cwd(), 'uploads', key);
    
    // Ensure parent directory exists
    fs.mkdirSync(join(filePath, '..'), { recursive: true });
    
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);
    
    writeStream.on('finish', () => {
      res.status(200).json({ success: true, path: `/uploads/${key}` });
    });
    
    writeStream.on('error', (err) => {
      console.error('[Mock R2 Upload Error]:', err);
      res.status(500).send('Upload failed');
    });
  });

  // Serve uploads folder static assets with R2 proxy fallback
  expressInstance.use(
    '/uploads',
    async (req: any, res: any, next: any) => {
      try {
        const r2Service = app.get(R2Service);
        if (r2Service && r2Service.isConfigured()) {
          const key = req.path.replace(/^\//, ''); // e.g. project/.../xxx.webp
          const stream = await r2Service.getObjectStream(key);
          if (stream) {
            res.setHeader('Content-Type', 'image/webp');
            return (stream as any).pipe(res);
          }
        }
      } catch (err) {
        // Fallback to static
      }
      next();
    },
    express.static(join(process.cwd(), 'uploads')),
  );

  // Register global validation pipe for request DTO validation
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
