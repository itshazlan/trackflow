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

jest.mock('better-auth/plugins', () => ({
  bearer: jest.fn().mockReturnValue(() => ({})),
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
import { user, session, account } from './../src/db/schema/auth';
import { appSettings } from './../src/db/schema/settings';
import { projects } from './../src/db/schema/projects';
import { issues, issueComments, issueTrackers, issueStatuses } from './../src/db/schema/issues';
import { timeBlocks } from './../src/db/schema/time-tracking';
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

    describe('User Deactivation & Hard Delete (DELETE /admin/users/:id)', () => {
      let testUserId: string;

      beforeEach(async () => {
        testUserId = 'test-e2e-del-user';
        await db.delete(user).where(eq(user.id, testUserId));
        await db.insert(user).values({
          id: testUserId,
          name: 'Test Deletable',
          email: 'deletable@tf.local',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          username: 'deletable_user',
          employmentStatus: 'active',
          isAdmin: false,
        });

        // Insert a mock session for the user
        await db.insert(session).values({
          id: 'test-session-id',
          userId: testUserId,
          token: 'test-session-token',
          expiresAt: new Date(Date.now() + 3600 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      afterEach(async () => {
        await db.delete(timeBlocks).where(eq(timeBlocks.userId, testUserId));
        await db.delete(issueComments).where(eq(issueComments.authorId, testUserId));
        await db.delete(issues).where(or(eq(issues.createdBy, testUserId), eq(issues.assigneeId, testUserId)));
        await db.delete(session).where(eq(session.userId, testUserId));
        await db.delete(account).where(eq(account.userId, testUserId));
        await db.delete(user).where(eq(user.id, testUserId));
      });

      it('should reject deactivation if caller is not an admin', async () => {
        await request(app.getHttpServer())
          .delete(`/admin/users/${testUserId}`)
          .set('x-mock-user-id', mockUsers.developer.id)
          .expect(403);
      });

      it('should deactivate user and delete their sessions by default', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/admin/users/${testUserId}`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .expect(200);

        expect(res.body.employmentStatus).toBe('inactive');

        const sessions = await db.select().from(session).where(eq(session.userId, testUserId));
        expect(sessions.length).toBe(0);
      });

      it('should reject hard delete if force is not true', async () => {
        await request(app.getHttpServer())
          .delete(`/admin/users/${testUserId}?force=false`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .expect(400);
      });

      it('should allow hard delete if force is true and user has no history', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/admin/users/${testUserId}?force=true`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .expect(200);

        expect(res.body.success).toBe(true);

        const users = await db.select().from(user).where(eq(user.id, testUserId));
        expect(users.length).toBe(0);
      });

      it('should reject hard delete if user has work history', async () => {
        const trackerId = '8f3d1c1a-2b3b-4c5c-8d9e-0f1a2b3c4d5e';
        const projectId = '7f3d1c1a-2b3b-4c5c-8d9e-0f1a2b3c4d5e';
        const statusId = '6f3d1c1a-2b3b-4c5c-8d9e-0f1a2b3c4d5e';
        const issueId = '5f3d1c1a-2b3b-4c5c-8d9e-0f1a2b3c4d5e';

        await db.delete(timeBlocks).where(eq(timeBlocks.userId, testUserId));
        await db.delete(issueComments).where(eq(issueComments.authorId, testUserId));
        await db.delete(issues).where(eq(issues.id, issueId));
        await db.delete(issueStatuses).where(eq(issueStatuses.id, statusId));
        await db.delete(projects).where(eq(projects.id, projectId));
        await db.delete(issueTrackers).where(eq(issueTrackers.id, trackerId));

        await db.insert(issueTrackers).values({ id: trackerId, name: `Del Tracker ${Date.now()}` });
        await db.insert(projects).values({ id: projectId, name: 'Del Project', key: 'DEL', createdBy: mockUsers.admin.id });
        await db.insert(issueStatuses).values({ id: statusId, projectId, name: 'Backlog', orderIndex: 0 });
        await db.insert(issues).values({
          id: issueId,
          projectId,
          trackerId,
          statusId,
          title: 'Del Issue',
          createdBy: testUserId,
          number: 1,
        });

        const res = await request(app.getHttpServer())
          .delete(`/admin/users/${testUserId}?force=true`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .expect(400);

        expect(res.body.message).toContain('riwayat data terkait');

        await db.delete(issues).where(eq(issues.id, issueId));
        await db.delete(issueStatuses).where(eq(issueStatuses.id, statusId));
        await db.delete(projects).where(eq(projects.id, projectId));
        await db.delete(issueTrackers).where(eq(issueTrackers.id, trackerId));
      });
    });
  });
});
