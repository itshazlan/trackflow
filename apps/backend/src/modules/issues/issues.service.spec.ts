import { IssuesService } from './issues.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('IssuesService - remove', () => {
  let service: IssuesService;
  let mockDb: any;
  let mockRealtimeGateway: any;
  let mockNotificationsService: any;

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
      onConflictDoNothing: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue([]),
      returning: jest.fn().mockResolvedValue([]),
    };

    mockRealtimeGateway = {
      emitIssueDeleted: jest.fn(),
      emitIssueUpdated: jest.fn(),
      emitCommentCreated: jest.fn(),
    };

    const mockR2Service = {} as any;
    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };
    const mockDiscordService = {
      notifyDiscordIssueCreated: jest.fn(),
    } as any;

    service = new IssuesService(
      mockDb,
      mockRealtimeGateway,
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
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([
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
        }),
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
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([
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
        }),
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
      await expect(
        service.recordView('user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActivity and status history', () => {
    it('should aggregate comments and status history chronologically', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { id: 'issue-1', projectId: 'proj-1' },
      ]);
      mockDb.limit.mockResolvedValueOnce([{ id: 'user-1', isAdmin: true }]);

      const commentsData = [
        {
          id: 'comment-1',
          issueId: 'issue-1',
          body: 'Hello',
          createdAt: new Date('2026-07-28T10:00:00Z'),
          commentAttachments: [],
        },
      ];

      const statusHistoryData = [
        {
          id: 'hist-1',
          issueId: 'issue-1',
          oldStatusName: null,
          newStatusName: 'Backlog',
          changedAt: new Date('2026-07-28T09:00:00Z'),
          changedBy: { id: 'user-1', name: 'User 1' },
        },
      ];

      jest
        .spyOn(service, 'findCommentsForIssue')
        .mockResolvedValue(commentsData as any);
      jest
        .spyOn(service, 'getStatusHistory')
        .mockResolvedValue(statusHistoryData as any);

      const result = await service.getActivity('issue-1', 'user-1');

      expect(result.activity).toHaveLength(2);
      expect(result.activity[0]).toEqual({
        type: 'status_change',
        ...statusHistoryData[0],
      });
      expect(result.activity[1]).toEqual({
        type: 'comment',
        ...commentsData[0],
        attachments: [],
      });
    });
  });

  describe('IssuesService - Collaborators', () => {
    it('should insert collaborators and send notifications during issue creation', async () => {
      const creatorUserId = 'user-creator';
      const collaboratorUserId = 'user-collab';
      const dto = {
        trackerId: 'tracker-1',
        statusId: 'status-1',
        title: 'New Issue with Collaborators',
        collaboratorIds: [creatorUserId, collaboratorUserId],
      };

      const mockTx = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          { issueSequence: 5, key: 'PRJ', name: 'Project 1' },
        ]),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
      };
      mockTx.insert.mockImplementation(() => {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'issue-new', number: 5, title: dto.title },
            ]),
          }),
        };
      });

      mockDb.transaction = jest
        .fn()
        .mockImplementation((cb: any) => cb(mockTx));
      mockDb.limit.mockResolvedValueOnce([{ name: 'Creator User' }]);

      const result = await service.create('proj-1', dto as any, creatorUserId);

      expect(result).toBeDefined();
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        {
          userId: collaboratorUserId,
          type: 'issue_collaborator_added',
          title: 'Ditambahkan sebagai Collaborator',
          body: 'Creator User menambahkan Anda sebagai collaborator di PRJ-5',
          entityType: 'issue',
          entityId: 'issue-new',
        },
      );
    });

    it('should allow any project member to self-add as collaborator', async () => {
      const actor = { id: 'user-dev', name: 'Dev User', isAdmin: false };
      const issueData = {
        id: 'issue-1',
        projectId: 'proj-1',
        assigneeId: 'user-assignee',
        number: 1,
        title: 'Test Issue',
        projectKey: 'PRJ',
        projectName: 'Project 1',
      };
      const membershipData = {
        userId: 'user-dev',
        projectId: 'proj-1',
        role: 'developer',
      };

      mockDb.limit.mockResolvedValueOnce([issueData]);
      mockDb.limit.mockResolvedValueOnce([membershipData]);
      mockDb.returning.mockResolvedValueOnce([{ id: 'collab-1' }]);

      const result = await service.addCollaborator(
        'issue-1',
        'user-dev',
        actor,
      );

      expect(result).toEqual({ message: 'Collaborator added successfully' });
      expect(
        mockNotificationsService.createNotification,
      ).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if regular developer attempts to add another person as collaborator', async () => {
      const actor = { id: 'user-dev', name: 'Dev User', isAdmin: false };
      const issueData = {
        id: 'issue-1',
        projectId: 'proj-1',
        assigneeId: 'user-assignee',
        number: 1,
        title: 'Test Issue',
        projectKey: 'PRJ',
        projectName: 'Project 1',
      };
      const membershipData = {
        userId: 'user-dev',
        projectId: 'proj-1',
        role: 'developer',
      };

      mockDb.limit.mockResolvedValueOnce([issueData]);
      mockDb.limit.mockResolvedValueOnce([membershipData]);

      await expect(
        service.addCollaborator('issue-1', 'user-other', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assignee to add another person as collaborator and notify them', async () => {
      const actor = {
        id: 'user-assignee',
        name: 'Assignee User',
        isAdmin: false,
      };
      const issueData = {
        id: 'issue-1',
        projectId: 'proj-1',
        assigneeId: 'user-assignee',
        number: 1,
        title: 'Test Issue',
        projectKey: 'PRJ',
        projectName: 'Project 1',
      };
      const actorMembership = {
        userId: 'user-assignee',
        projectId: 'proj-1',
        role: 'developer',
      };
      const targetUser = {
        id: 'user-other',
        name: 'Other User',
        isAdmin: false,
      };
      const targetMembership = {
        userId: 'user-other',
        projectId: 'proj-1',
        role: 'developer',
      };

      mockDb.limit.mockResolvedValueOnce([issueData]);
      mockDb.limit.mockResolvedValueOnce([actorMembership]);
      mockDb.limit.mockResolvedValueOnce([targetUser]);
      mockDb.limit.mockResolvedValueOnce([targetMembership]);
      mockDb.returning.mockResolvedValueOnce([{ id: 'collab-1' }]);

      const result = await service.addCollaborator(
        'issue-1',
        'user-other',
        actor,
      );

      expect(result).toEqual({ message: 'Collaborator added successfully' });
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        userId: 'user-other',
        type: 'issue_collaborator_added',
        title: 'Ditambahkan sebagai Collaborator',
        body: 'Assignee User menambahkan Anda sebagai collaborator di PRJ-1',
        entityType: 'issue',
        entityId: 'issue-1',
      });
    });

    it('should allow self-remove for any collaborator', async () => {
      const actor = { id: 'user-dev', name: 'Dev User', isAdmin: false };
      const issueData = {
        id: 'issue-1',
        projectId: 'proj-1',
        assigneeId: 'user-assignee',
      };
      const membershipData = {
        userId: 'user-dev',
        projectId: 'proj-1',
        role: 'developer',
      };

      mockDb.limit.mockResolvedValueOnce([issueData]);
      mockDb.limit.mockResolvedValueOnce([membershipData]);

      const result = await service.removeCollaborator(
        'issue-1',
        'user-dev',
        actor,
      );

      expect(result).toEqual({ message: 'Collaborator removed successfully' });
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if regular developer attempts to remove another person from collaborators', async () => {
      const actor = { id: 'user-dev', name: 'Dev User', isAdmin: false };
      const issueData = {
        id: 'issue-1',
        projectId: 'proj-1',
        assigneeId: 'user-assignee',
      };
      const membershipData = {
        userId: 'user-dev',
        projectId: 'proj-1',
        role: 'developer',
      };

      mockDb.limit.mockResolvedValueOnce([issueData]);
      mockDb.limit.mockResolvedValueOnce([membershipData]);

      await expect(
        service.removeCollaborator('issue-1', 'user-other', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('IssuesService - Excel Import', () => {
    it('should reject files that are not .xlsx', async () => {
      const invalidFile = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        size: 1000,
        buffer: Buffer.from('test'),
      } as any;

      await expect(
        service.previewImport('proj-1', invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files larger than 5MB', async () => {
      const largeFile = {
        originalname: 'test.xlsx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 6 * 1024 * 1024,
        buffer: Buffer.from('test'),
      } as any;

      await expect(
        service.previewImport('proj-1', largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should commit valid import rows and record audit log', async () => {
      const commitDto = {
        fileName: 'issues.xlsx',
        sheetName: 'Sheet1',
        rows: [
          {
            row: 2,
            title: '[BUG] Auth - Login fails',
            description: 'Login fails on Safari',
            trackerId: 'tracker-1',
            trackerName: 'Bug',
            priority: 'high' as const,
            dueDate: '2026-09-01',
            statusId: 'status-1',
            statusName: 'New',
          },
        ],
      };

      mockDb.from.mockResolvedValueOnce([{ id: 'tracker-1' }]);

      const mockTx = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          { issueSequence: 1, key: 'PRJ', name: 'Project 1' },
        ]),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
      };

      mockTx.insert.mockImplementation(() => {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'issue-imported-1', number: 1, title: commitDto.rows[0].title },
            ]),
          }),
        };
      });

      mockDb.transaction = jest
        .fn()
        .mockImplementation((cb: any) => cb(mockTx));

      const result = await service.commitImport(
        'proj-1',
        commitDto as any,
        'user-manager',
      );

      expect(result).toEqual({
        importedCount: 1,
        issueIds: ['issue-imported-1'],
      });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should return import history records for a project', async () => {
      const historyRecords = [
        {
          id: 'import-1',
          projectId: 'proj-1',
          fileName: 'issues.xlsx',
          sheetName: 'Sheet1',
          totalRows: 10,
          successRows: 10,
          errorRows: 0,
          importedAt: new Date(),
          importedBy: {
            id: 'user-manager',
            name: 'Manager User',
            email: 'manager@example.com',
            image: null,
          },
        },
      ];

      mockDb.orderBy.mockResolvedValueOnce(historyRecords);

      const result = await service.getImportHistory('proj-1');
      expect(result).toEqual(historyRecords);
    });
  });
});
