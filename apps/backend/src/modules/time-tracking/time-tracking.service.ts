import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, or, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  timeBlocks,
  activityLogs,
  screenshots,
  timeBlockAuditLogs,
} from '../../db/schema/time-tracking';
import { appSettings } from '../../db/schema/settings';
import { projectMemberships } from '../../db/schema/projects';
import { SyncTimeBlockDto } from './dto/sync-time-block.dto';
import { OverrideTimeBlockDto } from './dto/override-time-block.dto';
import { R2Service } from './r2.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TimeTrackingService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly r2Service: R2Service,
  ) {}

  async sync(dto: SyncTimeBlockDto, userObj: { id: string; isAdmin: boolean }) {
    const userId = userObj.id;

    // Validate project membership
    if (!userObj.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, dto.projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Not a member of this project');
      }
    }

    // 1. Get screenshot retention days from app_settings
    const [settings] = await this.db.select().from(appSettings).limit(1);
    const retentionDays = settings ? settings.screenshotRetentionDays : 365;

    // 2. Compute purgeAfter date
    const start = new Date(dto.blockStart);
    const end = new Date(dto.blockEnd);
    const purgeAfter = new Date(
      start.getTime() + retentionDays * 24 * 60 * 60 * 1000,
    );

    // 3. Determine activityLevel
    const totalInputs = dto.activity.keyboardCount + dto.activity.mouseCount;
    let activityLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (totalInputs > 100) {
      activityLevel = 'high';
    } else if (totalInputs > 20) {
      activityLevel = 'medium';
    } else if (totalInputs > 0) {
      activityLevel = 'low';
    }

    try {
      return await this.db.transaction(async (tx: any) => {
        // Insert time block
        const [timeBlock] = await tx
          .insert(timeBlocks)
          .values({
            userId,
            projectId: dto.projectId,
            issueId: dto.issueId || null,
            blockStart: start,
            blockEnd: end,
            purgeAfter: purgeAfter,
            isPaid: true,
          })
          .returning();

        // Insert activity log
        const [activityLog] = await tx
          .insert(activityLogs)
          .values({
            timeBlockId: timeBlock.id,
            keyboardCount: dto.activity.keyboardCount,
            mouseCount: dto.activity.mouseCount,
            activityLevel,
            activeAppName: dto.activity.activeAppName,
            activeWindowTitle: dto.activity.activeWindowTitle,
          })
          .returning();

        return { timeBlock, activityLog };
      });
    } catch (err) {
      console.error('[TimeTrackingService.sync Error]:', err);
      throw new InternalServerErrorException('Failed to sync time block');
    }
  }

  async getScreenshotUploadUrl(timeBlockId: string) {
    const [timeBlock] = await this.db
      .select()
      .from(timeBlocks)
      .where(eq(timeBlocks.id, timeBlockId))
      .limit(1);

    if (!timeBlock) {
      throw new NotFoundException(
        `Time block with ID ${timeBlockId} not found`,
      );
    }

    const projectId = timeBlock.projectId;
    const randomHash = randomUUID();
    const objectKey = `project/${projectId}/screenshots/${timeBlockId}_${randomHash}.webp`;

    // Generate presigned upload URL
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      objectKey,
      'image/webp',
    );

    // Create DB screenshot record
    const [screenshot] = await this.db
      .insert(screenshots)
      .values({
        timeBlockId,
        r2ObjectKey: objectKey,
        capturedAt: new Date(),
      })
      .returning();

    return {
      uploadUrl,
      r2ObjectKey: objectKey,
      screenshot,
    };
  }

  async findAllForUser(
    userId: string,
    projectId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const queryConditions = [
      eq(timeBlocks.userId, userId),
      eq(timeBlocks.isDeleted, false),
    ];

    if (projectId) {
      queryConditions.push(eq(timeBlocks.projectId, projectId));
    }
    if (startDate) {
      queryConditions.push(gte(timeBlocks.blockStart, new Date(startDate)));
    }
    if (endDate) {
      queryConditions.push(lte(timeBlocks.blockEnd, new Date(endDate)));
    }

    return this.db
      .select({
        id: timeBlocks.id,
        projectId: timeBlocks.projectId,
        issueId: timeBlocks.issueId,
        blockStart: timeBlocks.blockStart,
        blockEnd: timeBlocks.blockEnd,
        isPaid: timeBlocks.isPaid,
        activity: {
          keyboardCount: activityLogs.keyboardCount,
          mouseCount: activityLogs.mouseCount,
          activityLevel: activityLogs.activityLevel,
          activeAppName: activityLogs.activeAppName,
          activeWindowTitle: activityLogs.activeWindowTitle,
        },
        screenshot: {
          id: screenshots.id,
          r2ObjectKey: screenshots.r2ObjectKey,
          capturedAt: screenshots.capturedAt,
        },
      })
      .from(timeBlocks)
      .innerJoin(activityLogs, eq(timeBlocks.id, activityLogs.timeBlockId))
      .leftJoin(screenshots, eq(timeBlocks.id, screenshots.timeBlockId))
      .where(and(...queryConditions));
  }

  async selfDelete(timeBlockId: string, userId: string, reason?: string) {
    const [existing] = await this.db
      .select()
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.id, timeBlockId),
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.isDeleted, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Active time block with ID ${timeBlockId} not found for this user`,
      );
    }

    return this.db.transaction(async (tx: any) => {
      // 1. Delete screenshots from R2 and PG
      const projectScreenshots = await tx
        .select()
        .from(screenshots)
        .where(eq(screenshots.timeBlockId, timeBlockId));

      for (const s of projectScreenshots) {
        await this.r2Service.deleteObject(s.r2ObjectKey);
      }

      await tx
        .delete(screenshots)
        .where(eq(screenshots.timeBlockId, timeBlockId));

      // 2. Mark as deleted
      const [updated] = await tx
        .update(timeBlocks)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          deletionType: 'self',
          deletionReason: reason || null,
          isPaid: false,
        })
        .where(eq(timeBlocks.id, timeBlockId))
        .returning();

      // 3. Audit log
      await tx.insert(timeBlockAuditLogs).values({
        timeBlockId,
        action: 'self_delete',
        actorId: userId,
        targetUserId: userId,
        reason: reason || 'Self deleted by worker',
      });

      return updated;
    });
  }

  async adminOverride(
    timeBlockId: string,
    actorId: string,
    action: 'delete' | 'mark_unpaid',
    reason: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(timeBlocks)
      .where(eq(timeBlocks.id, timeBlockId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Time block with ID ${timeBlockId} not found`,
      );
    }

    return this.db.transaction(async (tx: any) => {
      let updated;

      if (action === 'delete') {
        // 1. Delete screenshots from R2 and PG
        const projectScreenshots = await tx
          .select()
          .from(screenshots)
          .where(eq(screenshots.timeBlockId, timeBlockId));

        for (const s of projectScreenshots) {
          await this.r2Service.deleteObject(s.r2ObjectKey);
        }

        await tx
          .delete(screenshots)
          .where(eq(screenshots.timeBlockId, timeBlockId));

        // 2. Perform Update
        [updated] = await tx
          .update(timeBlocks)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: actorId,
            deletionType: 'admin_override',
            deletionReason: reason,
            isPaid: false,
          })
          .where(eq(timeBlocks.id, timeBlockId))
          .returning();

        await tx.insert(timeBlockAuditLogs).values({
          timeBlockId,
          action: 'admin_override_delete',
          actorId,
          targetUserId: existing.userId,
          reason,
        });
      } else {
        // mark_unpaid
        [updated] = await tx
          .update(timeBlocks)
          .set({ isPaid: false })
          .where(eq(timeBlocks.id, timeBlockId))
          .returning();

        await tx.insert(timeBlockAuditLogs).values({
          timeBlockId,
          action: 'admin_override_mark_unpaid',
          actorId,
          targetUserId: existing.userId,
          reason,
        });
      }

      return updated;
    });
  }
}
