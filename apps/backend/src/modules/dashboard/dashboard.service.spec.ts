import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DRIZZLE } from '../../db/drizzle.provider';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate todayMinutes and overdueCount correctly', async () => {
    const mockUserTimeBlocks = [
      {
        blockStart: new Date(Date.now() - 3600000), // 1 hour ago
        blockEnd: new Date(),
      },
    ];

    const mockOverdueIssues = [{ id: 'issue-1' }, { id: 'issue-2' }];

    mockDb.select.mockImplementationOnce(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(mockUserTimeBlocks),
    }));

    mockDb.select.mockImplementationOnce(() => ({
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(mockOverdueIssues),
    }));

    mockDb.select.mockImplementationOnce(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ id: 'block-1', syncedAt: new Date() }]),
    }));

    const result = await service.getDashboardSummary('user-123');

    expect(result).toHaveProperty('todayMinutes');
    expect(result).toHaveProperty('overdueCount', 2);
    expect(result).toHaveProperty('activeTimerStatus');
    expect(result.activeTimerStatus?.isTracking).toBe(true);
    expect(result.todayMinutes).toBeGreaterThanOrEqual(59);
  });
});
