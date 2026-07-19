import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.provider';
import { notifications } from '../../db/schema/notifications';
import { eq, and, desc, count } from 'drizzle-orm';
import { RealtimeGateway } from '../../gateways/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createNotification(payload: {
    userId: string;
    type:
      | 'project_member_added'
      | 'issue_assigned'
      | 'issue_mentioned'
      | 'timesheet_approved'
      | 'timeblock_overridden';
    title: string;
    body: string;
    entityType: 'project' | 'issue' | 'timesheet' | 'time_block';
    entityId: string;
  }) {
    const [newNotification] = await this.db
      .insert(notifications)
      .values({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        entityType: payload.entityType,
        entityId: payload.entityId,
      })
      .returning();

    if (newNotification) {
      // Emit the notification via Socket.io
      this.realtimeGateway.server
        .to(`user:${payload.userId}`)
        .emit('notification.created', newNotification);
    }

    return newNotification;
  }

  async getNotifications(
    userId: string,
    unreadOnly: boolean,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;
    const whereClause = unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId);

    const data = await this.db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(whereClause);

    return {
      data,
      meta: {
        total: totalResult?.count || 0,
        page,
        limit,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    };
  }

  async readNotification(userId: string, id: string) {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to read this notification',
      );
    }

    const [updated] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();

    return updated;
  }

  async readAll(userId: string) {
    const updated = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId))
      .returning();

    return { count: updated.length };
  }
}
