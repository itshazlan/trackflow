import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  manualTimeEntries,
  timesheets,
  timesheetApprovals,
} from '../../db/schema/timesheets';
import { timeBlocks } from '../../db/schema/time-tracking';
import { projectMemberships } from '../../db/schema/projects';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { CreateTimesheetDto, ApproveTimesheetDto } from './dto/timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  // ─── Manual Time Entries ───────────────────────────────────────────────────

  async createManualEntry(dto: CreateManualEntryDto, userId: string) {
    // Validate project membership
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

    const [entry] = await this.db
      .insert(manualTimeEntries)
      .values({
        userId,
        projectId: dto.projectId,
        issueId: dto.issueId || null,
        durationMinutes: dto.durationMinutes,
        description: dto.description,
        entryDate: dto.entryDate,
      })
      .returning();

    return entry;
  }

  async findManualEntries(userId: string, projectId?: string) {
    const conditions: any[] = [eq(manualTimeEntries.userId, userId)];
    if (projectId) {
      conditions.push(eq(manualTimeEntries.projectId, projectId));
    }
    return this.db
      .select()
      .from(manualTimeEntries)
      .where(and(...conditions));
  }

  // ─── Timesheets ───────────────────────────────────────────────────────────

  async createTimesheet(dto: CreateTimesheetDto, userId: string) {
    // Validate membership
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

    // Aggregate time_blocks + manual_time_entries in the given period
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd + 'T23:59:59Z');

    const timeBlockRows = await this.db
      .select({
        blockStart: timeBlocks.blockStart,
        blockEnd: timeBlocks.blockEnd,
      })
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.userId, userId),
          eq(timeBlocks.projectId, dto.projectId),
          eq(timeBlocks.isDeleted, false),
          gte(timeBlocks.blockStart, start),
          lte(timeBlocks.blockEnd, end),
        ),
      );

    const manualRows = await this.db
      .select({ durationMinutes: manualTimeEntries.durationMinutes })
      .from(manualTimeEntries)
      .where(
        and(
          eq(manualTimeEntries.userId, userId),
          eq(manualTimeEntries.projectId, dto.projectId),
          gte(manualTimeEntries.entryDate, dto.periodStart),
          lte(manualTimeEntries.entryDate, dto.periodEnd),
        ),
      );

    // Calculate total minutes from time blocks
    let totalMinutes = 0;
    for (const row of timeBlockRows) {
      const diffMs =
        new Date(row.blockEnd).getTime() - new Date(row.blockStart).getTime();
      totalMinutes += Math.round(diffMs / 60000);
    }
    // Add manual entries
    for (const row of manualRows) {
      totalMinutes += row.durationMinutes;
    }

    const [timesheet] = await this.db
      .insert(timesheets)
      .values({
        userId,
        projectId: dto.projectId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        totalMinutes,
      })
      .returning();

    return timesheet;
  }

  async findTimesheets(userId: string, projectId?: string) {
    const conditions: any[] = [eq(timesheets.userId, userId)];
    if (projectId) {
      conditions.push(eq(timesheets.projectId, projectId));
    }
    return this.db
      .select()
      .from(timesheets)
      .where(and(...conditions));
  }

  async submitTimesheet(timesheetId: string, userId: string) {
    const [existing] = await this.db
      .select()
      .from(timesheets)
      .where(eq(timesheets.id, timesheetId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Timesheet ${timesheetId} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only submit your own timesheets');
    }
    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Timesheet is already in status "${existing.status}"`,
      );
    }

    const [updated] = await this.db
      .update(timesheets)
      .set({ status: 'submitted' })
      .where(eq(timesheets.id, timesheetId))
      .returning();

    return updated;
  }

  async approveTimesheet(
    timesheetId: string,
    reviewerId: string,
    dto: ApproveTimesheetDto,
    reviewerRole: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(timesheets)
      .where(eq(timesheets.id, timesheetId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Timesheet ${timesheetId} not found`);
    }

    // Only managers or admins of the project can approve
    if (reviewerRole !== 'manager' && reviewerRole !== 'admin') {
      throw new ForbiddenException(
        'Only managers or admins can approve timesheets',
      );
    }
    if (existing.status !== 'submitted') {
      throw new BadRequestException(
        `Timesheet must be in "submitted" status to approve/reject. Current: "${existing.status}"`,
      );
    }

    return this.db.transaction(async (tx: any) => {
      // Record the approval decision
      await tx.insert(timesheetApprovals).values({
        timesheetId,
        reviewedBy: reviewerId,
        decision: dto.decision,
        note: dto.note || null,
      });

      // Update timesheet status
      const [updated] = await tx
        .update(timesheets)
        .set({ status: dto.decision })
        .where(eq(timesheets.id, timesheetId))
        .returning();

      return updated;
    });
  }

  async getTimesheetDetail(
    timesheetId: string,
    userId: string,
    isAdmin: boolean,
  ) {
    const [timesheet] = await this.db
      .select()
      .from(timesheets)
      .where(eq(timesheets.id, timesheetId))
      .limit(1);

    if (!timesheet) {
      throw new NotFoundException(`Timesheet ${timesheetId} not found`);
    }

    // Non-admins can only view their own timesheets OR projects they manage
    if (!isAdmin && timesheet.userId !== userId) {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, timesheet.projectId),
            eq(projectMemberships.userId, userId),
            eq(projectMemberships.role, 'manager'),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Access denied');
      }
    }

    const approvals = await this.db
      .select()
      .from(timesheetApprovals)
      .where(eq(timesheetApprovals.timesheetId, timesheetId));

    return { ...timesheet, approvals };
  }
}
