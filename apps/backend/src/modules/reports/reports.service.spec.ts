import { ReportsService } from './reports.service';

describe('ReportsService - Live Status', () => {
  let service: ReportsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new ReportsService(mockDb);
  });

  it('should return live status list for users correctly', async () => {
    const mockUserAdmin = { id: 'admin-1', isAdmin: true };

    const mockRows = [
      {
        userId: 'user-1',
        name: 'User One',
        username: 'user1',
        avatar: null,
        email: 'user1@example.com',
        position: 'Developer',
        rawStatus: 'active',
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        issueId: 'issue-1',
        issueTitle: 'Fix Bug',
        issueNumber: 101,
        projectKey: 'PA',
        lastHeartbeatAt: new Date(),
      },
      {
        userId: 'user-2',
        name: 'User Two',
        username: 'user2',
        avatar: null,
        email: 'user2@example.com',
        position: 'Designer',
        rawStatus: 'idle',
        projectId: null,
        projectName: null,
        issueId: null,
        issueTitle: null,
        issueNumber: null,
        projectKey: null,
        lastHeartbeatAt: new Date(Date.now() - 60000),
      },
    ];

    const mockChain = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(mockRows),
    };

    mockDb.select.mockReturnValue(mockChain);

    const result = await service.getLiveStatus(mockUserAdmin);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('user-1');
    expect(result[0].status).toBe('active');
    expect(result[0].issueKey).toBe('PA-101');
    expect(result[1].userId).toBe('user-2');
    expect(result[1].status).toBe('idle');
  });

  it('should fall back status to offline if lastHeartbeatAt is older than 3 minutes', async () => {
    const mockUserAdmin = { id: 'admin-1', isAdmin: true };
    const staleDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const mockRows = [
      {
        userId: 'user-3',
        name: 'User Three',
        username: 'user3',
        avatar: null,
        email: 'user3@example.com',
        position: 'QA',
        rawStatus: 'active',
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        issueId: null,
        issueTitle: null,
        issueNumber: null,
        projectKey: 'PA',
        lastHeartbeatAt: staleDate,
      },
    ];

    const mockChain = {
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(mockRows),
    };

    mockDb.select.mockReturnValue(mockChain);

    const result = await service.getLiveStatus(mockUserAdmin);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-3');
    expect(result[0].status).toBe('offline');
  });
});
