import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, lt, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { timeBlocks } from '../../db/schema/time-tracking';
import { issues, issueStatuses } from '../../db/schema/issues';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async getDashboardSummary(userId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // 1. Calculate todayMinutes
    const userTimeBlocks = await this.db
      .select({
        blockStart: timeBlocks.blockStart,
        blockEnd: timeBlocks.blockEnd,
      })
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.isDeleted, false),
          gte(timeBlocks.blockStart, todayStart),
          lte(timeBlocks.blockStart, todayEnd),
        ),
      );

    let todayMinutes = 0;
    userTimeBlocks.forEach((block: any) => {
      const start = new Date(block.blockStart).getTime();
      const end = new Date(block.blockEnd).getTime();
      if (end > start) {
        todayMinutes += Math.round((end - start) / 60000);
      }
    });

    const todayDateStr = now.toISOString().split('T')[0];

    // 2. Calculate overdue issues count
    const overdueList = await this.db
      .select({
        id: issues.id,
      })
      .from(issues)
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(
        and(
          eq(issues.assigneeId, userId),
          eq(issueStatuses.isFinal, false),
          lt(issues.dueDate, todayDateStr),
        ),
      );

    const overdueCount = overdueList.length;

    // 3. Active timer status (desktop client tracker sync within last 15 minutes)
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [latestBlock] = await this.db
      .select({
        id: timeBlocks.id,
        syncedAt: timeBlocks.syncedAt,
        blockEnd: timeBlocks.blockEnd,
      })
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.isDeleted, false),
          gte(timeBlocks.syncedAt, fifteenMinsAgo),
        ),
      )
      .orderBy(desc(timeBlocks.syncedAt))
      .limit(1);

    const activeTimerStatus = {
      isTracking: !!latestBlock,
      lastActiveAt: latestBlock ? latestBlock.syncedAt : null,
    };

    return {
      todayMinutes,
      overdueCount,
      activeTimerStatus,
    };
  }
}
