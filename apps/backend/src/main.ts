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

  const expressInstance = app.getHttpAdapter().getInstance();

  // Custom CORS middleware to allow cross-origin requests from the Tauri application
  expressInstance.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:1420',
      'tauri://localhost',
      'https://tauri.localhost',
    ];
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
    next();
  });

  // 1. Mount Better Auth handler using a custom middleware to preserve req.url
  expressInstance.use((req: any, res: any, next: any) => {
    if (req.url.startsWith('/api/auth')) {
      console.log(`[Better Auth Middleware] Routing: ${req.method} ${req.url}`);
      return toNodeHandler(auth)(req, res);
    }
    next();
  });  // 2. Apply body parsers globally for all subsequent NestJS routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount mock-r2 handler for local file upload testing
  expressInstance.put('/mock-r2/:bucket/*key', (req: any, res: any) => {
    const keyParam = req.params.key || req.params[0];
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam;
    console.log(`[Mock R2 PUT] Upload request received. keyParam: ${JSON.stringify(keyParam)}, key: ${key}`);
    const filePath = join(process.cwd(), 'uploads', key);
    
    try {
      // Ensure parent directory exists
      fs.mkdirSync(join(filePath, '..'), { recursive: true });
      
      const writeStream = fs.createWriteStream(filePath);
      req.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log(`[Mock R2 PUT] Upload finished successfully: ${filePath}`);
        res.status(200).json({ success: true, path: `/uploads/${key}` });
      });
      
      writeStream.on('error', (err) => {
        console.error('[Mock R2 PUT Error] writeStream error:', err);
        res.status(500).send('Upload failed');
      });
    } catch (err) {
      console.error('[Mock R2 PUT Error] handler crash:', err);
      res.status(500).send('Upload failed');
    }
  });

  // Serve uploads folder static assets with R2 proxy fallback
  expressInstance.use(
    '/uploads',
    async (req: any, res: any, next: any) => {
      try {
        const r2Service = app.get(R2Service);
        if (r2Service && r2Service.isConfigured()) {
          const key = req.path.replace(/^\//, ''); // e.g. project/.../xxx.webp
          let stream: any = null;

          try {
            stream = await r2Service.getObjectStream(key);
          } catch (err) {
            // Fallback for double-encoded keys (Latin-1 interpreted as UTF-8)
            const fallbackKey = Buffer.from(key, 'utf8').toString('latin1');
            if (fallbackKey !== key) {
              try {
                stream = await r2Service.getObjectStream(fallbackKey);
              } catch (fallbackErr) {
                // Both keys failed
              }
            }
          }

          if (stream) {
            const ext = key.split('.').pop()?.toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === 'pdf') contentType = 'application/pdf';
            else if (ext === 'png') contentType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
            else if (ext === 'webp') contentType = 'image/webp';
            else if (ext === 'gif') contentType = 'image/gif';
            else if (ext === 'svg') contentType = 'image/svg+xml';
            else if (ext === 'txt') contentType = 'text/plain';

            res.setHeader('Content-Type', contentType);
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
