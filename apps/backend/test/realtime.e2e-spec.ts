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
import { user } from './../src/db/schema/auth';
import { projectMemberships } from './../src/db/schema/projects';
import { issueStatuses, issueTrackers } from './../src/db/schema/issues';
import { timeBlocks } from './../src/db/schema/time-tracking';
import { AuthGuard } from './../src/common/guards/auth.guard';
import { eq, or } from 'drizzle-orm';
import { io, Socket } from 'socket.io-client';

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

describe('Realtime Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let db: any;
  let socketUrl: string;

  const mockUsers = {
    developer: {
      id: 'mock-dev-rt',
      name: 'Realtime Developer',
      email: 'devrt@tf.local',
      username: 'mock_devrt',
      isAdmin: false,
    },
    admin: {
      id: 'mock-admin-rt',
      name: 'Realtime Admin',
      email: 'adminrt@tf.local',
      username: 'mock_adminrt',
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
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? '' : address.port;
    socketUrl = `http://localhost:${port}`;

    db = moduleFixture.get<any>(DRIZZLE);

    // Clean up
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
        ),
      );
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
  });

  afterAll(async () => {
    // Clean up
    await db
      .delete(projectMemberships)
      .where(
        or(
          eq(projectMemberships.userId, mockUsers.developer.id),
          eq(projectMemberships.userId, mockUsers.admin.id),
        ),
      );
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

  let projectId: string;
  let clientSocket: Socket;

  describe('WebSocket Operations', () => {
    it('should establish connection and receive user.status_changed online status', (done) => {
      clientSocket = io(socketUrl, {
        query: { userId: mockUsers.developer.id },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Connected successfully
      });

      clientSocket.on('user.status_changed', (data) => {
        if (
          data.userId === mockUsers.developer.id &&
          data.status === 'online'
        ) {
          done();
        }
      });
    });

    it('should allow user to join a project room', (done) => {
      // 1. Create project
      request(app.getHttpServer())
        .post('/projects')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({ name: 'Realtime Project' })
        .end((err, res) => {
          if (err) return done(err);
          projectId = res.body.id;

          // 2. Join project room via socket
          clientSocket.emit('joinProject', projectId, (ack: any) => {
            expect(ack.status).toBe('joined');
            expect(ack.project).toBe(projectId);
            done();
          });
        });
    });

    it('should broadcast timeblock.synced event to the room on sync', (done) => {
      // Setup listener
      clientSocket.on('timeblock.synced', (data) => {
        expect(data.timeBlock.projectId).toBe(projectId);
        expect(data.timeBlock.userId).toBe(mockUsers.developer.id);
        clientSocket.off('timeblock.synced');
        done();
      });

      // Trigger sync via endpoint
      request(app.getHttpServer())
        .post('/time-blocks/sync')
        .set('x-mock-user-id', mockUsers.developer.id)
        .send({
          projectId,
          blockStart: new Date().toISOString(),
          blockEnd: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          activity: {
            keyboardCount: 50,
            mouseCount: 30,
            activeAppName: 'VSCode',
            activeWindowTitle: 'main.ts',
          },
        })
        .expect(201)
        .end((err) => {
          if (err) done(err);
        });
    });

    it('should broadcast timeblock.overridden event on admin override', (done) => {
      // 1. Get the synced time block from database
      db.select()
        .from(timeBlocks)
        .where(eq(timeBlocks.projectId, projectId))
        .limit(1)
        .then(([tb]: any[]) => {
          expect(tb).toBeDefined();

          // Setup socket listener
          clientSocket.on('timeblock.overridden', (data) => {
            expect(data.timeBlockId).toBe(tb.id);
            expect(data.action).toBe('delete');
            clientSocket.off('timeblock.overridden');
            done();
          });

          // Trigger override via endpoint
          request(app.getHttpServer())
            .post(`/time-blocks/${tb.id}/override`)
            .set('x-mock-user-id', mockUsers.admin.id)
            .set('x-mock-is-admin', 'true')
            .send({
              action: 'delete',
              reason: 'Tested realtime delete override',
            })
            .expect(201)
            .end((err) => {
              if (err) done(err);
            });
        })
        .catch(done);
    });

    it('should broadcast issue.updated event when updating issue status', (done) => {
      let statusId: string;
      let trackerId: string;
      let issueId: string;

      // 1. Find Bug tracker
      db.select()
        .from(issueTrackers)
        .where(eq(issueTrackers.name, 'Bug'))
        .limit(1)
        .then(([tracker]: any[]) => {
          expect(tracker).toBeDefined();
          trackerId = tracker.id;

          // 2. Get status created automatically on project creation
          return db
            .select()
            .from(issueStatuses)
            .where(eq(issueStatuses.projectId, projectId))
            .limit(1);
        })
        .then(([status]: any[]) => {
          expect(status).toBeDefined();
          statusId = status.id;

          // 3. Create an issue
          return request(app.getHttpServer())
            .post(`/projects/${projectId}/issues`)
            .set('x-mock-user-id', mockUsers.developer.id)
            .send({
              trackerId,
              title: 'Realtime Issue title',
              description: 'Issue description',
              statusId,
            })
            .expect(201);
        })
        .then((res: any) => {
          issueId = res.body.id;

          // Setup socket listener
          clientSocket.on('issue.updated', (data) => {
            expect(data.id).toBe(issueId);
            clientSocket.off('issue.updated');
            done();
          });

          // 4. Patch status to trigger event
          return request(app.getHttpServer())
            .patch(`/issues/${issueId}/status`)
            .set('x-mock-user-id', mockUsers.developer.id)
            .send({ statusId })
            .expect(200);
        })
        .catch(done);
    });

    it('should clean up and receive user.status_changed offline status on disconnect', (done) => {
      // Connect another helper client to observe the disconnect event
      const observerSocket = io(socketUrl, {
        query: { userId: mockUsers.admin.id },
        transports: ['websocket'],
      });

      observerSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      observerSocket.on('user.status_changed', (data) => {
        if (
          data.userId === mockUsers.developer.id &&
          data.status === 'offline'
        ) {
          observerSocket.disconnect();
          done();
        }
      });
    });
  });
});
