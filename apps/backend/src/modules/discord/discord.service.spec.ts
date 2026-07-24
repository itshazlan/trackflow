import { DiscordService } from './discord.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DiscordService', () => {
  let service: DiscordService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    service = new DiscordService(mockDb);
  });

  describe('maskWebhookUrl', () => {
    it('should mask a standard Discord webhook URL', () => {
      const originalUrl =
        'https://discord.com/api/webhooks/123456789012345678/qwertyuiopasdfghjklzxcvbnm123456';
      const masked = service.maskWebhookUrl(originalUrl);
      expect(masked).toBe(
        'https://discord.com/api/webhooks/123456789012345678/***...masked',
      );
    });

    it('should handle invalid or empty URL gracefully without throwing', () => {
      expect(service.maskWebhookUrl('')).toBe('');
      expect(service.maskWebhookUrl('not-a-url')).toBe(
        'https://discord.com/api/webhooks/***...masked',
      );
    });
  });

  describe('getAppWebhook', () => {
    it('should return configured: false if no app-level webhook exists', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await service.getAppWebhook();
      expect(result).toEqual({ configured: false });
    });

    it('should return configured webhook with masked url', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'w1',
          projectId: null,
          webhookUrl:
            'https://discord.com/api/webhooks/111111/secret_token_abc',
          events: ['project_created'],
          createdAt: new Date(),
        },
      ]);

      const result = await service.getAppWebhook();
      expect(result.configured).toBe(true);
      expect(result.webhookUrl).toBe(
        'https://discord.com/api/webhooks/111111/***...masked',
      );
    });
  });

  describe('notifyDiscordProjectCreated', () => {
    it('should not throw even if fetch fails or network error occurs', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'w1',
          webhookUrl: 'https://discord.com/api/webhooks/111/secret',
          events: ['project_created'],
        },
      ]);

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.notifyDiscordProjectCreated({
          id: 'p1',
          key: 'PRJ',
          name: 'Project 1',
        }),
      ).resolves.not.toThrow();
    });
  });
});
