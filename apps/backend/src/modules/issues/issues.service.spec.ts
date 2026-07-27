import { IssuesService } from './issues.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('IssuesService - remove', () => {
  let service: IssuesService;
  let mockDb: any;
  let mockRealtimeGateway: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      offset: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue([]),
      returning: jest.fn().mockResolvedValue([]),
    };

    mockRealtimeGateway = {
      emitIssueDeleted: jest.fn(),
      emitIssueUpdated: jest.fn(),
      emitCommentCreated: jest.fn(),
    };

    const mockR2Service = {} as any;
    const mockNotificationsService = {} as any;
    const mockDiscordService = {} as any;

    service = new IssuesService(
      mockDb,
      mockRealtimeGateway as any,
      mockR2Service,
      mockNotificationsService,
      mockDiscordService,
    );
  });

  it('should allow the creator of the issue to delete it even if role is developer', async () => {
    const creatorUser = { id: 'user-creator', isAdmin: false };
    const issueData = {
      id: 'issue-1',
      projectId: 'proj-1',
      createdBy: 'user-creator',
      title: 'Test Issue',
      projectKey: 'PRJ',
      number: 1,
    };

    // Mock findOne (select issue)
    mockDb.limit.mockResolvedValueOnce([issueData]);
    // Mock delete returning
    mockDb.returning.mockResolvedValueOnce([issueData]);

    const result = await service.remove(
      'proj-1',
      'issue-1',
      creatorUser,
      'developer',
    );

    expect(result).toEqual({
      message: 'Issue deleted successfully',
      deleted: issueData,
    });
    expect(mockRealtimeGateway.emitIssueDeleted).toHaveBeenCalledWith(
      'proj-1',
      'issue-1',
    );
  });

  it('should allow a project manager to delete an issue created by someone else', async () => {
    const managerUser = { id: 'user-manager', isAdmin: false };
    const issueData = {
      id: 'issue-1',
      projectId: 'proj-1',
      createdBy: 'user-creator',
      title: 'Test Issue',
      projectKey: 'PRJ',
      number: 1,
    };

    mockDb.limit.mockResolvedValueOnce([issueData]);
    mockDb.returning.mockResolvedValueOnce([issueData]);

    const result = await service.remove(
      'proj-1',
      'issue-1',
      managerUser,
      'manager',
    );

    expect(result.deleted).toEqual(issueData);
  });

  it('should allow an Admin to delete an issue created by someone else', async () => {
    const adminUser = { id: 'user-admin', isAdmin: true };
    const issueData = {
      id: 'issue-1',
      projectId: 'proj-1',
      createdBy: 'user-creator',
      title: 'Test Issue',
      projectKey: 'PRJ',
      number: 1,
    };

    mockDb.limit.mockResolvedValueOnce([issueData]);
    mockDb.returning.mockResolvedValueOnce([issueData]);

    const result = await service.remove(
      'proj-1',
      'issue-1',
      adminUser,
      'developer',
    );

    expect(result.deleted).toEqual(issueData);
  });

  it('should forbid a non-creator non-manager (e.g. Assignee or other dev) from deleting issue', async () => {
    const assigneeUser = { id: 'user-assignee', isAdmin: false };
    const issueData = {
      id: 'issue-1',
      projectId: 'proj-1',
      createdBy: 'user-creator',
      title: 'Test Issue',
      projectKey: 'PRJ',
      number: 1,
    };

    mockDb.limit.mockResolvedValueOnce([issueData]);

    await expect(
      service.remove('proj-1', 'issue-1', assigneeUser, 'developer'),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('findMyIssues', () => {
    it('should return projects and issues grouped by project for list view', async () => {
      const user = { id: 'u1', isAdmin: false };
      // 1. Projects membership query
      mockDb.orderBy.mockResolvedValueOnce([
        { id: 'p1', key: 'PRJ', name: 'Project 1' },
      ]);
      // 2. Issues query
      mockDb.leftJoin.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            projectId: 'p1',
            title: 'Task 1',
            number: 1,
            projectKey: 'PRJ',
            projectName: 'Project 1',
            assigneeId: 'u1',
            dueDate: '2026-08-01',
          },
        ]),
      });

      const res = await service.findMyIssues(user, 'list');
      expect(res).toEqual({
        projects: [
          {
            projectId: 'p1',
            projectKey: 'PRJ',
            projectName: 'Project 1',
            issues: [
              expect.objectContaining({
                id: 'i1',
                displayId: 'PRJ-1',
              }),
            ],
          },
        ],
      });
    });

    it('should return flat list of issues with due dates for calendar view', async () => {
      const user = { id: 'u1', isAdmin: false };
      mockDb.orderBy.mockResolvedValueOnce([
        { id: 'p1', key: 'PRJ', name: 'Project 1' },
      ]);
      mockDb.leftJoin.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            projectId: 'p1',
            title: 'Task 1',
            number: 1,
            projectKey: 'PRJ',
            projectName: 'Project 1',
            assigneeId: 'u1',
            dueDate: '2026-08-01',
            status: { id: 's1', name: 'New' },
          },
          {
            id: 'i2',
            projectId: 'p1',
            title: 'Task 2 without due date',
            number: 2,
            projectKey: 'PRJ',
            projectName: 'Project 1',
            assigneeId: 'u1',
            dueDate: null,
            status: { id: 's1', name: 'New' },
          },
        ]),
      });

      const res = await service.findMyIssues(user, 'calendar');
      expect(res).toEqual({
        issues: [
          expect.objectContaining({
            id: 'i1',
            displayId: 'PRJ-1',
            dueDate: '2026-08-01',
            statusName: 'New',
          }),
        ],
      });
    });
  });

  describe('recently viewed issues', () => {
    it('should record an issue view with upsert and trim excess entries', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'iss-1' }]);
      mockDb.offset.mockResolvedValueOnce([]);

      const result = await service.recordView('user-1', 'iss-1');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if issue does not exist on recordView', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      await expect(service.recordView('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
