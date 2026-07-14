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
import { manualTimeEntries } from './../src/db/schema/timesheets';
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

describe('Reports & Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    developer: {
      id: 'mock-dev-rep',
      name: 'Report Developer',
      email: 'devrep@tf.local',
      username: 'mock_devrep',
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
      .where(or(eq(projectMemberships.userId, mockUsers.developer.id)));
    await db.delete(user).where(or(eq(user.id, mockUsers.developer.id)));

    // Seed mock user
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
      .where(or(eq(projectMemberships.userId, mockUsers.developer.id)));
    await db.delete(user).where(or(eq(user.id, mockUsers.developer.id)));
    await app.close();
  });

  let projectId: string;

  describe('Setup Project & Data', () => {
    it('should create a project and set developer membership', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          name: 'Reporting Test Project',
        })
        .expect(201);

      projectId = res.body.id;

      await db
        .insert(projectMemberships)
        .values([
          { projectId, userId: mockUsers.developer.id, role: 'developer' },
        ]);
    });

    it('should sync a 15-minute time block and two manual entries (one approved, one pending)', async () => {
      // 1. Sync 15-minute time block (auto-approved)
      const start = new Date('2026-07-14T09:00:00Z');
      const end = new Date('2026-07-14T09:15:00Z');

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
        keyboardCount: 80,
        mouseCount: 40,
        activityLevel: 'high',
        activeAppName: 'Xcode',
        activeWindowTitle: 'ContentView.swift',
      });

      // 2. Create approved manual time entry (45 mins)
      await db.insert(manualTimeEntries).values({
        userId: mockUsers.developer.id,
        projectId,
        durationMinutes: 45,
        description: 'Approved manual entry description',
        entryDate: '2026-07-14',
        approvalStatus: 'approved',
      });

      // 3. Create pending manual time entry (120 mins)
      await db.insert(manualTimeEntries).values({
        userId: mockUsers.developer.id,
        projectId,
        durationMinutes: 120,
        description: 'Pending manual entry description',
        entryDate: '2026-07-14',
        approvalStatus: 'pending',
      });
    });
  });

  describe('GET /reports/hours', () => {
    it('should reject invalid report formats (400)', async () => {
      await request(app.getHttpServer())
        .get('/reports/hours')
        .set('x-mock-user-id', mockUsers.developer.id)
        .query({
          format: 'invalid',
          projectId,
        })
        .expect(400);
    });

    it('should successfully return CSV report and aggregate ONLY approved entries (60 mins total)', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/hours')
        .set('x-mock-user-id', mockUsers.developer.id)
        .query({
          format: 'csv',
          projectId,
          startDate: '2026-07-14',
          endDate: '2026-07-14',
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      const csvContent = res.text;

      // Header row check
      expect(csvContent).toContain(
        'Date,User,Project,Issue,Type,Duration (Mins),Status',
      );
      // Time block check
      expect(csvContent).toContain('"Automatic",15,"Paid"');
      // Approved entry check
      expect(csvContent).toContain(
        '"N/A","Manual",45,"APPROVED"',
      );
      // Pending entry check MUST NOT be in the CSV
      expect(csvContent).not.toContain('Pending manual entry description');
      // Totals check (15 mins + 45 mins = 60 mins / 1.00 hour)
      expect(csvContent).toContain('Total Minutes,,,,,60');
      expect(csvContent).toContain('Total Hours,,,,,1.00');
    });

    it('should successfully return PDF report containing detailed logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/hours')
        .set('x-mock-user-id', mockUsers.developer.id)
        .query({
          format: 'pdf',
          projectId,
          startDate: '2026-07-14',
          endDate: '2026-07-14',
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      // Buffer must contain PDF header
      const pdfBuffer = res.body;
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });
});
