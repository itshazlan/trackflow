import { Injectable, Inject, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { pushSubscriptions } from '../../db/schema/push-subscriptions';
import { issues } from '../../db/schema/issues';
import { SubscribePushDto } from './dto/push.dto';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  getVapidPublicKey() {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
    };
  }

  async subscribe(
    userId: string,
    dto: SubscribePushDto,
    userAgentHeader?: string,
  ) {
    const userAgent = dto.userAgent || userAgentHeader || null;

    const [existing] = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, dto.endpoint))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dhKey: dto.keys.p256dh,
          authKey: dto.keys.auth,
          userAgent,
        })
        .where(eq(pushSubscriptions.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: dto.endpoint,
        p256dhKey: dto.keys.p256dh,
        authKey: dto.keys.auth,
        userAgent,
      })
      .returning();

    return created;
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );

    return { success: true };
  }

  async sendPushToUser(userId: string, notification: any) {
    const subscriptions = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@trackflow.app';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys not configured. Skipping push notification.');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    let url = `/issues/${notification.entityId}`;
    if (notification.entityType === 'project') {
      url = `/projects/${notification.entityId}`;
    } else if (notification.entityType === 'issue') {
      try {
        const [targetIssue] = await this.db
          .select({ projectId: issues.projectId })
          .from(issues)
          .where(eq(issues.id, notification.entityId))
          .limit(1);

        if (targetIssue?.projectId) {
          url = `/projects/${targetIssue.projectId}/issues/${notification.entityId}`;
        } else {
          url = `/issues/${notification.entityId}`;
        }
      } catch (err) {
        url = `/issues/${notification.entityId}`;
      }
    } else if (notification.entityType === 'timesheet') {
      url = `/timesheets/${notification.entityId}`;
    } else if (notification.entityType === 'time_block') {
      url = `/time-tracking`;
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url,
    });


    await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dhKey,
                auth: sub.authKey,
              },
            },
            payload,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
          } else {
            this.logger.warn(
              `Push delivery failed for sub ${sub.id}: ${err.message}`,
            );
          }
        }
      }),
    );
  }
}
