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
  issueStatuses,
  issueTemplates,
  issueTrackers,
  issueAttachments,
} from './../src/db/schema/issues';
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

describe('Issues and Workflow Statuses (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    manager: {
      id: 'mock-mgr-2',
      name: 'Manager',
      email: 'mgr2@tf.local',
      username: 'mock_mgr2',
      isAdmin: false,
    },
    developer: {
      id: 'mock-dev-2',
      name: 'Developer',
      email: 'dev2@tf.local',
      username: 'mock_dev2',
      isAdmin: false,
    },
    reporter: {
      id: 'mock-rep-2',
      name: 'Reporter',
      email: 'rep2@tf.local',
      username: 'mock_rep2',
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

    // Cleanup mock data
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.manager.id),
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.reporter.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.reporter.id),
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
    // Cleanup
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.manager.id),
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.reporter.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.reporter.id),
        ),
      );
    await app.close();
  });

  let projectId: string;
  let bugTrackerId: string;
  let bugTemplateId: string;
  let defaultStatuses: any[] = [];
  let issueId: string;

  describe('Project and Status Auto-Seeding', () => {
    it('should create a project and auto-seed 6 statuses (New ... Done)', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          name: 'Core Issue Project',
          key: 'CORE',
          description: 'Project for testing tickets slice',
        })
        .expect(201);

      projectId = res.body.id;

      // Add developer and reporter
      await db.insert(projectMemberships).values([
        { projectId, userId: mockUsers.developer.id, role: 'developer' },
        { projectId, userId: mockUsers.reporter.id, role: 'reporter_qa' },
      ]);

      // Verify statuses in DB
      defaultStatuses = await db
        .select()
        .from(issueStatuses)
        .where(eq(issueStatuses.projectId, projectId))
        .orderBy(issueStatuses.orderIndex);

      expect(defaultStatuses).toHaveLength(6);
      expect(defaultStatuses[0].name).toBe('New');
      expect(defaultStatuses[5].name).toBe('Done');
      expect(defaultStatuses[5].restrictedToRole).toBe('reporter_qa');
    });

    it('should list workflow statuses via /projects/:id/issue-statuses', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/issue-statuses`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(6);
      expect(res.body[0].name).toBe('New');
    });
  });

  describe('Templates and Issue Trackers', () => {
    it('should fetch Bug tracker and verify global Bug template exists', async () => {
      // Find Bug tracker
      const trackers = await db
        .select()
        .from(issueTrackers)
        .where(eq(issueTrackers.name, 'Bug'));
      expect(trackers).toHaveLength(1);
      bugTrackerId = trackers[0].id;

      // Find Bug Template
      const templates = await db
        .select()
        .from(issueTemplates)
        .where(eq(issueTemplates.name, 'Bug Report'));
      expect(templates.length).toBeGreaterThanOrEqual(1);
      bugTemplateId = templates[0].id;
    });

    it('should list templates via projects/:id/issue-templates', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/issue-templates`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const bugTemplate = res.body.find((t: any) => t.name === 'Bug Report');
      expect(bugTemplate).toBeDefined();
    });
  });

  describe('Issue Creation and Title/Field Validation', () => {
    it('should reject creating an issue if title is omitted (400)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/issues`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          trackerId: bugTrackerId,
          description: 'Some description',
        })
        .expect(400);
    });

    it('should successfully create an issue with plain title and description', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/issues`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          trackerId: bugTrackerId,
          title: '[BUG] Authentication - Crash on login',
          description: 'Role User: Reporter\nCurrent Condition: App crash\nEnvironment: Staging iOS App',
        })
        .expect(201);

      expect(res.body.title).toBe('[BUG] Authentication - Crash on login');
      expect(res.body.description).toBe(
        'Role User: Reporter\nCurrent Condition: App crash\nEnvironment: Staging iOS App',
      );
      expect(res.body.statusId).toBe(defaultStatuses[0].id); // defaults to 'New'
      expect(res.body.number).toBe(1);
      expect(res.body.projectKey).toBe('CORE');
      expect(res.body.displayId).toBe('CORE-1');
      issueId = res.body.id;
    });
  });

  describe('Issue Status Updates & Role Constraints', () => {
    it('should reject transitioning to Done if user role is developer (403)', async () => {
      const doneStatus = defaultStatuses.find((s: any) => s.name === 'Done');

      await request(app.getHttpServer())
        .patch(`/issues/${issueId}/status`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          statusId: doneStatus.id,
        })
        .expect(403);
    });

    it('should allow transitioning to Done if user role is reporter_qa (200)', async () => {
      const doneStatus = defaultStatuses.find((s: any) => s.name === 'Done');

      const res = await request(app.getHttpServer())
        .patch(`/issues/${issueId}/status`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .send({
          statusId: doneStatus.id,
        })
        .expect(200);

      expect(res.body.statusId).toBe(doneStatus.id);
    });
  });

  describe('Issue Attachments', () => {
    let attachmentId: string;

    it('should fail to create attachment if issue does not exist (404)', async () => {
      const nonExistentIssueId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/issues/${nonExistentIssueId}/attachments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          fileName: 'screenshot.png',
          contentType: 'image/png',
        })
        .expect(404);
    });

    it('should fail to create attachment if user is not a project member (403)', async () => {
      const outsiderId = 'mock-outsider';
      await db.insert(user).values({
        id: outsiderId,
        name: 'Outsider',
        email: 'outsider@tf.local',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        username: 'outsider',
        isAdmin: false,
      });

      try {
        await request(app.getHttpServer())
          .post(`/issues/${issueId}/attachments`)
          .set('x-mock-user-id', outsiderId)
          .send({
            fileName: 'screenshot.png',
            contentType: 'image/png',
          })
          .expect(403);
      } finally {
        await db.delete(user).where(eq(user.id, outsiderId));
      }
    });

    it('should successfully create attachment and generate presigned URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/issues/${issueId}/attachments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          fileName: 'log.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.r2ObjectKey).toBeDefined();
      expect(res.body.attachment).toBeDefined();
      expect(res.body.attachment.fileName).toBe('log.txt');
      expect(res.body.attachment.uploadedBy).toBe(mockUsers.developer.id);

      attachmentId = res.body.attachment.id;
    });

    it('should list attachments for the issue', async () => {
      const res = await request(app.getHttpServer())
        .get(`/issues/${issueId}/attachments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(attachmentId);
      expect(res.body[0].fileName).toBe('log.txt');
    });

    it('should fail to delete attachment if user is not the uploader or admin (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/issues/${issueId}/attachments/${attachmentId}`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .expect(403);
    });

    it('should successfully delete attachment if user is the uploader (200)', async () => {
      await request(app.getHttpServer())
        .delete(`/issues/${issueId}/attachments/${attachmentId}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/issues/${issueId}/attachments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });
});
