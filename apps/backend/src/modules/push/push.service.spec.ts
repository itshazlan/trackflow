import { PushService } from './push.service';
import * as webpush from 'web-push';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushService', () => {
  let service: PushService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.VAPID_PUBLIC_KEY = 'test_public_key';
    process.env.VAPID_PRIVATE_KEY = 'test_private_key';
    process.env.VAPID_SUBJECT = 'mailto:test@trackflow.app';

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

    service = new PushService(mockDb);
  });

  describe('getVapidPublicKey', () => {
    it('should return VAPID public key from env', () => {
      const res = service.getVapidPublicKey();
      expect(res).toEqual({ publicKey: 'test_public_key' });
    });
  });

  describe('subscribe', () => {
    it('should insert a new push subscription if endpoint does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.returning.mockResolvedValueOnce([
        {
          id: 'sub-1',
          userId: 'user-1',
          endpoint: 'https://push.example.com/sub-1',
          p256dhKey: 'p256dh_val',
          authKey: 'auth_val',
          userAgent: 'Mozilla/5.0',
        },
      ]);

      const result = await service.subscribe(
        'user-1',
        {
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'p256dh_val', auth: 'auth_val' },
        },
        'Mozilla/5.0',
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe('sub-1');
    });

    it('should update existing subscription if endpoint already exists', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'existing-sub-id',
          endpoint: 'https://push.example.com/sub-1',
        },
      ]);
      mockDb.returning.mockResolvedValueOnce([
        {
          id: 'existing-sub-id',
          userId: 'user-1',
          endpoint: 'https://push.example.com/sub-1',
          p256dhKey: 'new_p256dh',
          authKey: 'new_auth',
          userAgent: 'Mozilla/5.0',
        },
      ]);

      const result = await service.subscribe(
        'user-1',
        {
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'new_p256dh', auth: 'new_auth' },
        },
        'Mozilla/5.0',
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.id).toBe('existing-sub-id');
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription with matching userId and endpoint', async () => {
      const res = await service.unsubscribe(
        'user-1',
        'https://push.example.com/sub-1',
      );
      expect(mockDb.delete).toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });
  });

  describe('sendPushToUser', () => {
    it('should send notification to all user subscriptions', async () => {
      const mockSubs = [
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/sub-1',
          p256dhKey: 'p256',
          authKey: 'auth',
        },
      ];
      mockDb.where.mockResolvedValueOnce(mockSubs);
      (webpush.sendNotification as jest.Mock).mockResolvedValueOnce({});

      const notification = {
        title: 'New Issue',
        body: 'You have been assigned',
        entityType: 'issue',
        entityId: 'issue-123',
      };

      await service.sendPushToUser('user-1', notification);

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@trackflow.app',
        'test_public_key',
        'test_private_key',
      );
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://push.example.com/sub-1',
          keys: { p256dh: 'p256', auth: 'auth' },
        },
        JSON.stringify({
          title: 'New Issue',
          body: 'You have been assigned',
          url: '/issues/issue-123',
        }),
      );
    });

    it('should delete subscription when webpush returns 410 or 404', async () => {
      const mockSubs = [
        {
          id: 'expired-sub-id',
          endpoint: 'https://push.example.com/expired',
          p256dhKey: 'p256',
          authKey: 'auth',
        },
      ];
      mockDb.where.mockResolvedValueOnce(mockSubs);
      const error: any = new Error('Subscription expired');
      error.statusCode = 410;
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(error);

      const notification = {
        title: 'Notice',
        body: 'Test',
        entityType: 'project',
        entityId: 'prj-1',
      };

      await service.sendPushToUser('user-1', notification);

      expect(webpush.sendNotification).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
