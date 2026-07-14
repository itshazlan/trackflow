/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
jest.mock('better-auth', () => ({
  betterAuth: jest.fn().mockReturnValue({
    api: {
      getSession: jest.fn(),
      signUpEmail: jest.fn().mockImplementation(async ({ body }) => {
        await Promise.resolve();
        return {
          user: {
            id: 'newly-created-user-id',
            email: body.email,
            name: body.name,
            username: body.username,
          },
        };
      }),
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
import { appSettings } from './../src/db/schema/settings';
import { AuthGuard } from './../src/common/guards/auth.guard';
import { eq, or } from 'drizzle-orm';

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

describe('Administration (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    developer: {
      id: 'mock-dev-adm',
      name: 'Regular Developer',
      email: 'devadm@tf.local',
      username: 'mock_devadm',
      isAdmin: false,
    },
    admin: {
      id: 'mock-adm-adm',
      name: 'System Admin',
      email: 'admadm@tf.local',
      username: 'mock_admadm',
      isAdmin: true,
    },
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

    // Clean up users
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.admin.id),
        ),
      );

    // Seed mock users
    for (const u of Object.values(mockUsers)) {
      await db.insert(user).values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        username: u.username,
        isAdmin: u.isAdmin,
      });
    }

    // Seed app_settings row if not exists
    const settings = await db.select().from(appSettings).limit(1);
    if (settings.length === 0) {
      await db.insert(appSettings).values({
        companyName: 'TrackFlow Org',
        screenshotRetentionDays: 365,
      });
    }
  });

  afterAll(async () => {
    // Clean up users
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.admin.id),
        ),
      );
    await app.close();
  });

  describe('Strict AdminGuard Protection (Non-Admins)', () => {
    it('should reject GET /admin/settings with 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings')
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(403);
    });

    it('should reject PATCH /admin/settings with 403', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({ companyName: 'Hacker Corp' })
        .expect(403);
    });

    it('should reject GET /admin/users with 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(403);
    });

    it('should reject POST /admin/users with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          email: 'hack@tf.local',
          name: 'Hacker',
          username: 'hacker',
        })
        .expect(403);
    });

    it('should reject PATCH /admin/users/:id/employment with 403', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${mockUsers.developer.id}/employment`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({ position: 'Senior CEO' })
        .expect(403);
    });
  });

  describe('Admin Operations (Admins)', () => {
    it('should allow admin to GET settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .expect(200);

      expect(res.body).toHaveProperty('companyName');
      expect(res.body).toHaveProperty('screenshotRetentionDays');
    });

    it('should allow admin to PATCH settings', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/settings')
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({
          companyName: 'TrackFlow LLC',
          screenshotRetentionDays: 90,
        })
        .expect(200);

      expect(res.body.companyName).toBe('TrackFlow LLC');
      expect(res.body.screenshotRetentionDays).toBe(90);
    });

    it('should allow admin to GET users list', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      // Verify passwords are not included
      for (const u of res.body) {
        expect(u).not.toHaveProperty('password');
      }
    });

    it('should allow admin to create a new user (POST /admin/users)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({
          email: 'newworker@tf.local',
          password: 'TempPassword123!',
          name: 'New Worker',
          username: 'newworker',
          position: 'Intern',
          department: 'Engineering',
          employeeId: 'EMP-999',
          joinDate: '2026-07-14',
          employmentStatus: 'active',
        })
        .expect(201);

      expect(res.body.email).toBe('newworker@tf.local');
      expect(res.body.name).toBe('New Worker');

      // Cleanup created user
      await db.delete(user).where(eq(user.id, res.body.id as string));
    });

    it('should allow admin to PATCH employment details', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${mockUsers.developer.id}/employment`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({
          position: 'Lead Software Architect',
          department: 'Core Infrastructure',
          employeeId: 'EMP-DEV-007',
          joinDate: '2026-07-01',
          employmentStatus: 'active',
        })
        .expect(200);

      expect(res.body.position).toBe('Lead Software Architect');
      expect(res.body.department).toBe('Core Infrastructure');
      expect(res.body.employeeId).toBe('EMP-DEV-007');
      expect(res.body.joinDate).toBeDefined();
    });
  });
});
