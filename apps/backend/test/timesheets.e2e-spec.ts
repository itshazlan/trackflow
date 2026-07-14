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
import { projectMemberships } from './../src/db/schema/projects';
import {
  manualTimeEntries,
  timesheetApprovals,
} from './../src/db/schema/timesheets';
import { timeBlocks, activityLogs } from './../src/db/schema/time-tracking';
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

describe('Timesheet & Approvals (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    manager: {
      id: 'mock-mgr-ts',
      name: 'Manager',
      email: 'mgrts@tf.local',
      username: 'mock_mgrts',
      isAdmin: false,
    },
    developer: {
      id: 'mock-dev-ts',
      name: 'Developer',
      email: 'devts@tf.local',
      username: 'mock_devts',
      isAdmin: false,
    },
    admin: {
      id: 'mock-adm-ts',
      name: 'Admin User',
      email: 'admts@tf.local',
      username: 'mock_admts',
      isAdmin: true,
    },
    nonmember: {
      id: 'mock-non-ts',
      name: 'Nonmember',
      email: 'nonts@tf.local',
      username: 'mock_nonts',
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
  let manualEntryId: string;
  let timesheetId: string;

  describe('Setup Project & Membership', () => {
    it('should create a project and add manager and developer', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          name: 'Approvals Project',
        })
        .expect(201);

      projectId = res.body.id;

      await db.insert(projectMemberships).values([
        { projectId, userId: mockUsers.manager.id, role: 'manager' },
        { projectId, userId: mockUsers.developer.id, role: 'developer' },
      ]);
    });
  });

  describe('Sync Time Block & Create Manual Entry', () => {
    it('should sync a 10-minute time block for the developer', async () => {
      const start = new Date('2026-07-14T09:00:00Z');
      const end = new Date('2026-07-14T09:10:00Z');

      const [tb] = await db
        .insert(timeBlocks)
        .values({
          userId: mockUsers.developer.id,
          projectId,
          blockStart: start,
          blockEnd: end,
          purgeAfter: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          isPaid: true,
        })
        .returning();

      await db.insert(activityLogs).values({
        timeBlockId: tb.id,
        keyboardCount: 50,
        mouseCount: 50,
        activityLevel: 'medium',
        activeAppName: 'VS Code',
        activeWindowTitle: 'main.ts',
      });
    });

    it('should create a manual time entry for 30 minutes in pending status', async () => {
      const res = await request(app.getHttpServer())
        .post('/manual-time-entries')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          projectId,
          durationMinutes: 30,
          description: 'Client coordination meeting',
          entryDate: '2026-07-14',
        })
        .expect(201);

      expect(res.body.approvalStatus).toBe('pending');
      manualEntryId = res.body.id;
    });
  });

  describe('Create Timesheet before manual entry approval', () => {
    it('should aggregate only the time block minutes (10 mins) because manual entry is pending', async () => {
      const res = await request(app.getHttpServer())
        .post('/timesheets')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          projectId,
          periodStart: '2026-07-14',
          periodEnd: '2026-07-14',
        })
        .expect(201);

      expect(res.body.totalMinutes).toBe(10);
      timesheetId = res.body.id;
    });
  });

  describe('Approve Manual Time Entry', () => {
    it('should reject approval if caller is developer (403)', async () => {
      await request(app.getHttpServer())
        .post(`/manual-time-entries/${manualEntryId}/approve`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          decision: 'approved',
          note: 'Self-approval attempt',
        })
        .expect(403);
    });

    it('should reject approval if caller is non-member (403)', async () => {
      await request(app.getHttpServer())
        .post(`/manual-time-entries/${manualEntryId}/approve`)
        .set('x-mock-user-id', mockUsers.nonmember.id)
        .send({
          decision: 'approved',
          note: 'Unauthorized approval attempt',
        })
        .expect(403);
    });

    it('should allow manager to approve manual time entry', async () => {
      const res = await request(app.getHttpServer())
        .post(`/manual-time-entries/${manualEntryId}/approve`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          decision: 'approved',
          note: 'Meeting verified on calendar',
        })
        .expect(201);

      expect(res.body.approvalStatus).toBe('approved');

      // Verify in DB
      const [entry] = await db
        .select()
        .from(manualTimeEntries)
        .where(eq(manualTimeEntries.id, manualEntryId))
        .limit(1);

      expect(entry.approvalStatus).toBe('approved');
    });
  });

  describe('Create Timesheet after manual entry approval', () => {
    it('should aggregate time block + approved manual entry minutes (10 + 30 = 40 mins)', async () => {
      const res = await request(app.getHttpServer())
        .post('/timesheets')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          projectId,
          periodStart: '2026-07-14',
          periodEnd: '2026-07-14',
        })
        .expect(201);

      expect(res.body.totalMinutes).toBe(40);
      timesheetId = res.body.id; // use the updated timesheet ID
    });
  });

  describe('Submit & Approve Timesheet', () => {
    it('should allow worker to submit their timesheet', async () => {
      const res = await request(app.getHttpServer())
        .post(`/timesheets/${timesheetId}/submit`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(201);

      expect(res.body.status).toBe('submitted');
    });

    it('should reject timesheet approval if reviewer is developer (403)', async () => {
      await request(app.getHttpServer())
        .post(`/timesheets/${timesheetId}/approve`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          decision: 'approved',
          note: 'Reviewing own timesheet',
        })
        .expect(403);
    });

    it('should allow manager to approve timesheet and create approval log', async () => {
      const res = await request(app.getHttpServer())
        .post(`/timesheets/${timesheetId}/approve`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          decision: 'approved',
          note: 'All looks correct.',
        })
        .expect(201);

      expect(res.body.status).toBe('approved');

      // Verify approval record
      const dbApprovals = await db
        .select()
        .from(timesheetApprovals)
        .where(eq(timesheetApprovals.timesheetId, timesheetId));

      expect(dbApprovals).toHaveLength(1);
      expect(dbApprovals[0].decision).toBe('approved');
      expect(dbApprovals[0].reviewedBy).toBe(mockUsers.manager.id);
    });
  });
});
