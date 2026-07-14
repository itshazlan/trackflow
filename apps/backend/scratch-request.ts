import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const server = app.getHttpServer();

  // Try to request using the active session token of Hamzah Alvana
  // Session Token: MwpIVqSsoMZBb8O2f48uZZAsKqe3CSrK
  console.log('Sending request as Hamzah Alvana (should be 403 or 404/500)...');
  const res1 = await request(server)
    .get('/projects/e02fb8e1-602f-4a76-a2e8-71fac66088a3')
    .set('Cookie', `better-auth.session_token=MwpIVqSsoMZBb8O2f48uZZAsKqe3CSrK`);

  console.log('Status:', res1.status);
  console.log('Body:', res1.body);

  // Let's also try to request using the Admin session token (which should be 200)
  // Session Token: 0RiI1ZmMY6derGRd6ZNeVfWx3xF5VxSf
  console.log('\nSending request as Admin (should be 200)...');
  const res2 = await request(server)
    .get('/projects/e02fb8e1-602f-4a76-a2e8-71fac66088a3')
    .set('Cookie', `better-auth.session_token=0RiI1ZmMY6derGRd6ZNeVfWx3xF5VxSf`);

  console.log('Status:', res2.status);
  console.log('Body:', res2.body);

  await app.close();
}

main().catch(console.error);
