/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
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
import { projectMemberships } from './../src/db/schema/projects';
import {
  timeBlocks,
  activityLogs,
  screenshots,
  timeBlockAuditLogs,
} from './../src/db/schema/time-tracking';
import { user } from './../src/db/schema/auth';
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

describe('Time Tracking (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    manager: {
      id: 'mock-mgr-tt',
      name: 'Manager',
      email: 'mgrtt@tf.local',
      username: 'mock_mgrtt',
      isAdmin: false,
    },
    developer: {
      id: 'mock-dev-tt',
      name: 'Developer',
      email: 'devtt@tf.local',
      username: 'mock_devtt',
      isAdmin: false,
    },
    admin: {
      id: 'mock-adm-tt',
      name: 'Admin User',
      email: 'admtt@tf.local',
      username: 'mock_admtt',
      isAdmin: true,
    },
    nonmember: {
      id: 'mock-non-tt',
      name: 'Nonmember',
      email: 'nontt@tf.local',
      username: 'mock_nontt',
      isAdmin: false,
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

    // Clean up
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.manager.id),
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
          eq(projectMemberships.userId, mockUsers.nonmember.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.admin.id),
          eq(user.id, mockUsers.nonmember.id),
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
  });

  afterAll(async () => {
    // Clean up
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.manager.id),
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
          eq(projectMemberships.userId, mockUsers.nonmember.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.admin.id),
          eq(user.id, mockUsers.nonmember.id),
        ),
      );
    await app.close();
  });

  let projectId: string;
  let timeBlockId: string;

  describe('Project Setup', () => {
    it('should create a project and set memberships', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          name: 'Time Tracking Project',
          key: 'TIME',
        })
        .expect(201);

      projectId = res.body.id;

      await db
        .insert(projectMemberships)
        .values([
          { projectId, userId: mockUsers.developer.id, role: 'developer' },
        ]);
    });
  });

  describe('POST /time-blocks/sync', () => {
    it('should reject sync if user is not project member (403)', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks/sync')
        .set('x-mock-user-id', mockUsers.nonmember.id)
        .send({
          projectId,
          blockStart: new Date(Date.now() - 600000).toISOString(),
          blockEnd: new Date().toISOString(),
          activity: {
            keyboardCount: 50,
            mouseCount: 50,
            activeAppName: 'VS Code',
            activeWindowTitle: 'time-tracking.service.ts',
          },
        })
        .expect(403);
    });

    it('should successfully sync time block for developer and calculate activity level', async () => {
      const start = new Date(Date.now() - 600000).toISOString();
      const end = new Date().toISOString();

      const res = await request(app.getHttpServer())
        .post('/time-blocks/sync')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          projectId,
          blockStart: start,
          blockEnd: end,
          activity: {
            keyboardCount: 150, // total > 100 -> high activity
            mouseCount: 20,
            activeAppName: 'VS Code',
            activeWindowTitle: 'time-tracking.service.ts',
          },
        })
        .expect(201);

      expect(res.body.timeBlock).toHaveProperty('id');
      expect(res.body.timeBlock.projectId).toBe(projectId);
      expect(res.body.timeBlock.userId).toBe(mockUsers.developer.id);
      expect(res.body.activityLog.activityLevel).toBe('high');

      timeBlockId = res.body.timeBlock.id;
    });
  });

  describe('POST /time-blocks/:id/screenshot (Presigned URL)', () => {
    it('should generate a presigned URL and create screenshots DB row', async () => {
      const res = await request(app.getHttpServer())
        .post(`/time-blocks/${timeBlockId}/screenshot`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(201);

      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('r2ObjectKey');
      expect(res.body.r2ObjectKey).toContain(projectId);
      expect(res.body.screenshot.timeBlockId).toBe(timeBlockId);

      // Verify in DB
      const dbScreenshots = await db
        .select()
        .from(screenshots)
        .where(eq(screenshots.timeBlockId, timeBlockId));

      expect(dbScreenshots).toHaveLength(1);
      expect(dbScreenshots[0].r2ObjectKey).toBe(res.body.r2ObjectKey);
    });
  });

  describe('DELETE /time-blocks/:id (Self Deletion)', () => {
    it('should allow worker to self delete time block, setting isPaid=false and cleaning screenshots', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/time-blocks/${timeBlockId}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          reason: 'Forgot to turn off tracker while browsing YouTube',
        })
        .expect(200);

      expect(res.body.isDeleted).toBe(true);
      expect(res.body.isPaid).toBe(false);
      expect(res.body.deletionType).toBe('self');

      // Verify audit log exists
      const logs = await db
        .select()
        .from(timeBlockAuditLogs)
        .where(eq(timeBlockAuditLogs.timeBlockId, timeBlockId));

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('self_delete');
      expect(logs[0].actorId).toBe(mockUsers.developer.id);

      // Verify screenshots are deleted from DB
      const dbScreenshots = await db
        .select()
        .from(screenshots)
        .where(eq(screenshots.timeBlockId, timeBlockId));

      expect(dbScreenshots).toHaveLength(0);
    });
  });

  describe('POST /time-blocks/:id/override (Admin Override)', () => {
    let newTimeBlockId: string;

    beforeEach(async () => {
      // Sync a new block to override
      const start = new Date(Date.now() - 600000).toISOString();
      const end = new Date().toISOString();

      const res = await db.transaction(async (tx: any) => {
        const [tb] = await tx
          .insert(timeBlocks)
          .values({
            userId: mockUsers.developer.id,
            projectId,
            blockStart: new Date(start),
            blockEnd: new Date(end),
            purgeAfter: new Date(Date.now() + 365 * 24 * 3600 * 1000),
            isPaid: true,
          })
          .returning();

        await tx.insert(activityLogs).values({
          timeBlockId: tb.id,
          keyboardCount: 50,
          mouseCount: 50,
          activityLevel: 'medium',
          activeAppName: 'Slack',
          activeWindowTitle: 'General Chat',
        });

        // Add a mock screenshot
        await tx.insert(screenshots).values({
          timeBlockId: tb.id,
          r2ObjectKey: `project/${projectId}/screenshots/${tb.id}_mock.webp`,
        });

        return tb;
      });

      newTimeBlockId = res.id;
    });

    it('should reject override if caller is not admin (403)', async () => {
      await request(app.getHttpServer())
        .post(`/time-blocks/${newTimeBlockId}/override`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          action: 'mark_unpaid',
          reason: 'Unauthorized attempt',
        })
        .expect(403);
    });

    it('should allow admin to mark unpaid', async () => {
      const res = await request(app.getHttpServer())
        .post(`/time-blocks/${newTimeBlockId}/override`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({
          action: 'mark_unpaid',
          reason: 'Did not match assigned ticket activity',
        })
        .expect(201);

      expect(res.body.isPaid).toBe(false);
      expect(res.body.isDeleted).toBe(false);

      const logs = await db
        .select()
        .from(timeBlockAuditLogs)
        .where(eq(timeBlockAuditLogs.timeBlockId, newTimeBlockId));

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('admin_override_mark_unpaid');
    });

    it('should allow admin to delete time block, setting isPaid=false and cleaning screenshots', async () => {
      const res = await request(app.getHttpServer())
        .post(`/time-blocks/${newTimeBlockId}/override`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({
          action: 'delete',
          reason: 'Inappropriate content',
        })
        .expect(201);

      expect(res.body.isDeleted).toBe(true);
      expect(res.body.isPaid).toBe(false);

      // Verify screenshots deleted
      const dbScreenshots = await db
        .select()
        .from(screenshots)
        .where(eq(screenshots.timeBlockId, newTimeBlockId));

      expect(dbScreenshots).toHaveLength(0);

      // Verify audit log
      const logs = await db
        .select()
        .from(timeBlockAuditLogs)
        .where(eq(timeBlockAuditLogs.timeBlockId, newTimeBlockId));

      // 1 from seed during beforeEach + 1 override delete
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const actionTypes = logs.map((l: any) => l.action);
      expect(actionTypes).toContain('admin_override_delete');
    });
  });
});
