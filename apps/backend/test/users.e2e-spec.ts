/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
jest.mock('better-auth', () => ({
  betterAuth: jest.fn().mockReturnValue({
    api: {
      getSession: jest.fn(),
    },
  }),
}));

jest.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DRIZZLE } from './../src/db/drizzle.provider';
import { user } from './../src/db/schema/auth';
import { AuthGuard } from './../src/common/guards/auth.guard';
import { eq } from 'drizzle-orm';

class MockAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-mock-user-id'];
    const isAdmin = req.headers['x-mock-is-admin'] === 'true';
    if (!userId) {
      throw new UnauthorizedException('No mock user ID provided');
    }
    req.user = { id: userId, isAdmin };
    await Promise.resolve();
    return true;
  }
}

describe('Users Profile (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUser = {
    id: 'mock-user-profile-id',
    name: 'Profile User',
    email: 'profile@tf.local',
    emailVerified: false,
    username: 'profile_user',
    createdAt: new Date(),
    updatedAt: new Date(),
    isAdmin: false,
    position: 'Developer',
    department: 'Engineering',
    employeeId: 'EMP-1111',
    employmentStatus: 'active',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    db = moduleFixture.get<any>(DRIZZLE);

    // Clean up and seed mock user
    await db.delete(user).where(eq(user.id, mockUser.id));
    await db.insert(user).values(mockUser);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, mockUser.id));
    await app.close();
  });

  describe('GET /users/me', () => {
    it('should retrieve the authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('x-mock-user-id', mockUser.id)
        .expect(200);

      expect(res.body.id).toBe(mockUser.id);
      expect(res.body.username).toBe(mockUser.username);
      expect(res.body.email).toBe(mockUser.email);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('PATCH /users/me', () => {
    it('should update allowed fields (username, phoneNumber, position, department)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('x-mock-user-id', mockUser.id)
        .send({
          username: 'profile_user_updated',
          phoneNumber: '081234567890',
          position: 'Senior Engineer',
          department: 'Core Infrastructure',
        })
        .expect(200);

      expect(res.body.username).toBe('profile_user_updated');
      expect(res.body.phoneNumber).toBe('081234567890');
      expect(res.body.position).toBe('Senior Engineer');
      expect(res.body.department).toBe('Core Infrastructure');
    });

    it('should silently ignore attempts to edit read-only fields (employeeId, isAdmin, etc)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('x-mock-user-id', mockUser.id)
        .send({
          employeeId: 'EMP-HACKED',
          isAdmin: true,
          employmentStatus: 'inactive',
        })
        .expect(200);

      // Verify that fields remain unchanged in database
      const [dbUser] = await db.select().from(user).where(eq(user.id, mockUser.id));
      expect(dbUser.employeeId).toBe(mockUser.employeeId);
      expect(dbUser.isAdmin).toBe(false);
      expect(dbUser.employmentStatus).toBe('active');
    });
  });

  describe('POST /users/me/avatar', () => {
    it('should generate a presigned avatar upload url and update user.image path', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set('x-mock-user-id', mockUser.id)
        .expect(201);

      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('publicUrl');
      expect(res.body.publicUrl).toContain(`/api/uploads/avatars/${mockUser.id}.webp`);

      // Verify that user.image has been updated in database
      const [dbUser] = await db.select().from(user).where(eq(user.id, mockUser.id));
      expect(dbUser.image).toBe(res.body.publicUrl);
    });
  });
});
