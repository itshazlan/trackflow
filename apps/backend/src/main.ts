import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './modules/auth/better-auth.config';
import { json, urlencoded } from 'express';

async function bootstrap() {
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
  app.use(json());
  app.use(urlencoded({ extended: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
