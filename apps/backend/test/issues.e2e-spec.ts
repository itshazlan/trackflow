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
        .attach('file', Buffer.from('test contents'), 'screenshot.png')
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
          .attach('file', Buffer.from('test contents'), 'screenshot.png')
          .expect(403);
      } finally {
        await db.delete(user).where(eq(user.id, outsiderId));
      }
    });

    it('should successfully create attachment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/issues/${issueId}/attachments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .attach('file', Buffer.from('mock logs'), 'log.txt')
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.fileName).toBe('log.txt');
      expect(res.body.uploadedBy).toBe(mockUsers.developer.id);

      attachmentId = res.body.id;
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

  describe('Issue Updating and Permissions', () => {
    it('should allow the Project Manager to update the issue', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/issues/${issueId}`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          title: 'Updated Title by Manager',
          description: 'Updated description by manager',
        })
        .expect(200);

      expect(res.body.title).toBe('Updated Title by Manager');
      expect(res.body.description).toBe('Updated description by manager');
    });

    it('should allow the Creator of the issue (Developer) to update the issue', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/issues/${issueId}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          title: 'Updated Title by Creator',
        })
        .expect(200);

      expect(res.body.title).toBe('Updated Title by Creator');
    });

    it('should forbid a project member who is not assignee/creator/manager from updating the issue (403)', async () => {
      // Reporter is a member of the project but not manager, and is not assignee/creator of the issue
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/issues/${issueId}`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .send({
          title: 'Unauthorized Edit Attempt',
        })
        .expect(403);
    });

    it('should ignore attempts to modify protected fields like number, projectId, and createdBy', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/issues/${issueId}`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          title: 'Title after protected fields check',
          number: 9999,
          projectId: '00000000-0000-0000-0000-000000000000',
          createdBy: 'some-other-user-id',
        })
        .expect(200);

      expect(res.body.title).toBe('Title after protected fields check');
      expect(res.body.number).not.toBe(9999);
      expect(res.body.projectId).toBe(projectId);
      expect(res.body.createdBy).toBe(mockUsers.developer.id);
    });
  });

  describe('Issue Comments (Forum-Style)', () => {
    let commentId: string;

    it('should successfully add a comment as a Developer (project member)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          body: 'This is a test comment by developer',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.body).toBe('This is a test comment by developer');
      expect(res.body.author.id).toBe(mockUsers.developer.id);
      expect(res.body.author.name).toBe(mockUsers.developer.name);
      expect(res.body.updatedAt).toBeNull();
      
      commentId = res.body.id;
    });

    it('should list comments in chronological order for project members (Developer)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(commentId);
      expect(res.body[0].body).toBe('This is a test comment by developer');
    });

    it('should allow another project member (Reporter) to read comments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('should forbid non-project members from reading or writing comments (403)', async () => {
      const outsiderId = 'mock-outsider-comments';
      await db.insert(user).values({
        id: outsiderId,
        name: 'Comments Outsider',
        email: 'outsidercomm@tf.local',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        username: 'outsidercomm',
        isAdmin: false,
      });

      try {
        // Read attempt
        await request(app.getHttpServer())
          .get(`/issues/${issueId}/comments`)
          .set('x-mock-user-id', outsiderId)
          .expect(403);

        // Write attempt
        await request(app.getHttpServer())
          .post(`/issues/${issueId}/comments`)
          .set('x-mock-user-id', outsiderId)
          .send({ body: 'Outsider comment attempt' })
          .expect(403);
      } finally {
        await db.delete(user).where(eq(user.id, outsiderId));
      }
    });

    it('should allow the author to edit their own comment (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/issues/${issueId}/comments/${commentId}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          body: 'This is my edited comment',
        })
        .expect(200);

      expect(res.body.body).toBe('This is my edited comment');
      expect(res.body.updatedAt).not.toBeNull();
    });

    it('should forbid editing other users comments (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/issues/${issueId}/comments/${commentId}`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .send({
          body: 'Malicious edit attempt',
        })
        .expect(403);
    });

    it('should forbid deleting other users comments if not admin (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/issues/${issueId}/comments/${commentId}`)
        .set('x-mock-user-id', mockUsers.reporter.id)
        .expect(403);
    });

    it('should allow the author to delete their own comment', async () => {
      await request(app.getHttpServer())
        .delete(`/issues/${issueId}/comments/${commentId}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('should allow Admin to delete any comment (moderation)', async () => {
      // 1. Create a comment as Developer
      const createRes = await request(app.getHttpServer())
        .post(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          body: 'Spam comment to be deleted by Admin',
        })
        .expect(201);

      const newCommentId = createRes.body.id;

      // 2. Delete as Admin
      await request(app.getHttpServer())
        .delete(`/issues/${issueId}/comments/${newCommentId}`)
        .set('x-mock-user-id', 'admin-moderator')
        .set('x-mock-is-admin', 'true')
        .expect(200);

      // 3. Verify it is deleted
      const listRes = await request(app.getHttpServer())
        .get(`/issues/${issueId}/comments`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(listRes.body).toHaveLength(0);
    });
  });
});
