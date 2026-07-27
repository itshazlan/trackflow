import { ReportsService } from './reports.service';

describe('ReportsService - Activity Ranking', () => {
  let service: ReportsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    service = new ReportsService(mockDb);
  });

  it('should calculate activity score correctly and sort users', async () => {
    const mockUserAdmin = { id: 'admin-1', isAdmin: true };

    const mockRows = [
      {
        userId: 'user-1',
        userName: 'User One',
        userUsername: 'user1',
        userAvatar: null,
        totalMinutes: 120,
        none: 1,
        low: 1,
        medium: 2,
        high: 2,
        totalBlocks: 6,
      },
      {
        userId: 'user-2',
        userName: 'User Two',
        userUsername: 'user2',
        userAvatar: null,
        totalMinutes: 180,
        none: 0,
        low: 0,
        medium: 1,
        high: 3,
        totalBlocks: 4,
      },
    ];

    const mockChain = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockResolvedValue(mockRows),
    };

    mockDb.select.mockReturnValue(mockChain);

    const result = await service.getActivityRanking(mockUserAdmin, 'week');

    expect(result).toHaveLength(2);
    // User Two score: (3*3 + 1*2) / 4 = 11 / 4 = 2.75
    // User One score: (2*3 + 2*2 + 1*1 + 1*0) / 6 = 11 / 6 = 1.83
    expect(result[0].userId).toBe('user-2');
    expect(result[0].activityScore).toBe(2.75);
    expect(result[1].userId).toBe('user-1');
    expect(result[1].activityScore).toBe(1.83);
  });
});
