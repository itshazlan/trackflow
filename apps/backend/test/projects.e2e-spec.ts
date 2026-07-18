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
import { projects, projectMemberships } from './../src/db/schema/projects';
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

describe('Projects and Memberships (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;

  const mockUsers = {
    manager: {
      id: 'mock-mgr',
      name: 'Manager',
      email: 'mgr@tf.local',
      username: 'mock_mgr',
      isAdmin: false,
    },
    developer: {
      id: 'mock-dev',
      name: 'Developer',
      email: 'dev@tf.local',
      username: 'mock_dev',
      isAdmin: false,
    },
    reporter: {
      id: 'mock-rep',
      name: 'Reporter',
      email: 'rep@tf.local',
      username: 'mock_rep',
      isAdmin: false,
    },
    other: {
      id: 'mock-oth',
      name: 'Other User',
      email: 'oth@tf.local',
      username: 'mock_oth',
      isAdmin: false,
    },
    admin: {
      id: 'mock-adm',
      name: 'Admin User',
      email: 'adm@tf.local',
      username: 'mock_adm',
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

    // Clean up any leftover mock data from previous runs
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.manager.id),
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.reporter.id),
          eq(projectMemberships.userId, mockUsers.other.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.reporter.id),
          eq(user.id, mockUsers.other.id),
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
          eq(projectMemberships.userId, mockUsers.other.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
        ),
      );
    await db
      .delete(user)
      .where(
        or(
          eq(user.id, mockUsers.manager.id),
          eq(user.id, mockUsers.developer.id),
          eq(user.id, mockUsers.reporter.id),
          eq(user.id, mockUsers.other.id),
          eq(user.id, mockUsers.admin.id),
        ),
      );
    await app.close();
  });

  let mainProjectId: string;
  let subProjectId: string;

  describe('Project Creation', () => {
    it('should create a top-level project and make the creator a manager', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          name: 'Main E2E Project',
          key: 'MAIN',
          description: 'Top-level project for testing',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Main E2E Project');
      mainProjectId = res.body.id;

      // Verify membership
      const membership = await db
        .select()
        .from(projectMemberships)
        .where(eq(projectMemberships.projectId, mainProjectId));

      expect(membership).toHaveLength(1);
      expect(membership[0].userId).toBe(mockUsers.manager.id);
      expect(membership[0].role).toBe('manager');
    });
  });

  describe('Project Memberships', () => {
    it('should allow manager to add a developer to the project', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          userId: mockUsers.developer.id,
          role: 'developer',
        })
        .expect(201);

      expect(res.body.projectId).toBe(mainProjectId);
      expect(res.body.userId).toBe(mockUsers.developer.id);
      expect(res.body.role).toBe('developer');
    });

    it('should allow manager to add a reporter_qa to the project', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          userId: mockUsers.reporter.id,
          role: 'reporter_qa',
        })
        .expect(201);
    });

    it('should reject adding a member if calling user is not a manager (403)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          userId: mockUsers.other.id,
          role: 'developer',
        })
        .expect(403);
    });

    it('should reject adding a member if calling user is not in the project (403)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.other.id)
        .send({
          userId: mockUsers.other.id,
          role: 'developer',
        })
        .expect(403);
    });

    it('should list all members of the project', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(res.body).toHaveLength(3); // Manager, Developer, Reporter
      const roles = res.body.map((m: any) => m.role);
      expect(roles).toContain('manager');
      expect(roles).toContain('developer');
      expect(roles).toContain('reporter_qa');
    });

    it('should allow manager to update a member role via PATCH /projects/:id/members/:userId', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/members/${mockUsers.developer.id}`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          role: 'reporter_qa',
        })
        .expect(200);

      expect(res.body.role).toBe('reporter_qa');
    });

    it('should allow manager to update a member role via body PATCH /projects/:id/members', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/members`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          userId: mockUsers.developer.id,
          role: 'developer',
        })
        .expect(200);

      expect(res.body.role).toBe('developer');
    });

    it('should reject updating member role if calling user is not a manager (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/members/${mockUsers.developer.id}`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          role: 'manager',
        })
        .expect(403);
    });
  });

  describe('Sub-projects Creation and Listing', () => {
    it('should allow manager to create a sub-project', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/sub-projects`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({
          name: 'Sub-Project A',
          key: 'SUBA',
          description: 'A sub-project under main project',
        })
        .expect(201);

      expect(res.body.parentProjectId).toBe(mainProjectId);
      subProjectId = res.body.id;
    });

    it('should reject creating a sub-project if calling user is developer (403)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mainProjectId}/sub-projects`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          name: 'Sub-Project B',
        })
        .expect(403);
    });

    it('should list sub-projects of the project via both paths', async () => {
      // 1. GET /projects/:id/sub-projects (hyphenated)
      const resHyphen = await request(app.getHttpServer())
        .get(`/projects/${mainProjectId}/sub-projects`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(resHyphen.body).toHaveLength(1);
      expect(resHyphen.body[0].id).toBe(subProjectId);

      // 2. GET /projects/:id/subprojects (unhyphenated)
      const resNoHyphen = await request(app.getHttpServer())
        .get(`/projects/${mainProjectId}/subprojects`)
        .set('x-mock-user-id', mockUsers.developer.id)
        .expect(200);

      expect(resNoHyphen.body).toHaveLength(1);
      expect(resNoHyphen.body[0].id).toBe(subProjectId);
    });
  });

  describe('Project Archiving & Restoring', () => {
    it('should reject archiving parent project if sub-project is active (400)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/archive`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .expect(400);
    });

    it('should allow manager to archive sub-project first', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${subProjectId}/archive`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .expect(200);

      expect(res.body.archivedAt).not.toBeNull();
      expect(res.body.archivedBy).toBe(mockUsers.manager.id);
    });

    it('should allow manager to archive parent project once all sub-projects are archived', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/archive`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .expect(200);

      expect(res.body.archivedAt).not.toBeNull();
      expect(res.body.archivedBy).toBe(mockUsers.manager.id);
    });

    it('should allow manager to restore a project', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${mainProjectId}/restore`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .expect(200);

      expect(res.body.archivedAt).toBeNull();
      expect(res.body.archivedBy).toBeNull();
    });
  });

  describe('Project Hard Deletion', () => {
    it('should reject hard delete if not admin (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${mainProjectId}`)
        .set('x-mock-user-id', mockUsers.manager.id)
        .send({ confirmKey: 'MAIN' })
        .expect(403);
    });

    it('should reject hard delete if confirmKey does not match (400)', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${mainProjectId}`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({ confirmKey: 'WRONGKEY' })
        .expect(400);
    });

    it('should allow admin to hard delete project with correct confirmKey (200)', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${mainProjectId}`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .send({ confirmKey: 'MAIN' })
        .expect(200);

      // Verify that project is deleted (404 for Admin)
      await request(app.getHttpServer())
        .get(`/projects/${mainProjectId}`)
        .set('x-mock-user-id', mockUsers.admin.id)
        .set('x-mock-is-admin', 'true')
        .expect(404);
    });

    describe('Project Details Update (PATCH /projects/:id)', () => {
      let tempProjectId: string;

      beforeEach(async () => {
        tempProjectId = 'd3b07384-d113-4ec5-a555-e7a9e63f538e';
        await db.delete(projects).where(eq(projects.id, tempProjectId));
        await db.insert(projects).values({
          id: tempProjectId,
          name: 'Original Name',
          key: 'ORIG',
          description: 'Original Description',
          createdBy: mockUsers.admin.id,
          createdAt: new Date(),
        });
      });

      afterEach(async () => {
        await db.delete(projectMemberships).where(eq(projectMemberships.projectId, tempProjectId));
        await db.delete(projects).where(eq(projects.id, tempProjectId));
      });

      it('should reject update if calling user is not a manager or admin', async () => {
        await request(app.getHttpServer())
          .patch(`/projects/${tempProjectId}`)
          .set('x-mock-user-id', mockUsers.developer.id)
          .send({ name: 'Hack Name' })
          .expect(403);
      });

      it('should allow project manager to update name and description', async () => {
        await db.insert(projectMemberships).values({
          projectId: tempProjectId,
          userId: mockUsers.developer.id,
          role: 'manager',
        });

        const res = await request(app.getHttpServer())
          .patch(`/projects/${tempProjectId}`)
          .set('x-mock-user-id', mockUsers.developer.id)
          .send({ name: 'Updated Name', description: 'Updated Description' })
          .expect(200);

        expect(res.body.name).toBe('Updated Name');
        expect(res.body.description).toBe('Updated Description');
        expect(res.body.key).toBe('ORIG');
      });

      it('should allow admin to update name and description', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/projects/${tempProjectId}`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .send({ name: 'Admin Updated Name', description: 'Admin Updated Description' })
          .expect(200);

        expect(res.body.name).toBe('Admin Updated Name');
        expect(res.body.description).toBe('Admin Updated Description');
      });

      it('should reject update if user tries to update the project key', async () => {
        await request(app.getHttpServer())
          .patch(`/projects/${tempProjectId}`)
          .set('x-mock-user-id', mockUsers.admin.id)
          .set('x-mock-is-admin', 'true')
          .send({ key: 'NEWKEY' })
          .expect(400);
      });
    });
  });
});
