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
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    mockRealtimeGateway = {
      emitIssueDeleted: jest.fn(),
      emitIssueUpdated: jest.fn(),
      emitCommentCreated: jest.fn(),
    };

    service = new IssuesService(mockDb, mockRealtimeGateway as any);
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
});
