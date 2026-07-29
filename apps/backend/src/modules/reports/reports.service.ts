import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, and, gte, lte, count, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  timeBlocks,
  activityLogs,
  userLiveStatus,
} from '../../db/schema/time-tracking';
import { manualTimeEntries } from '../../db/schema/timesheets';
import { user } from '../../db/schema/auth';
import { projects, projectMemberships } from '../../db/schema/projects';
import { issues } from '../../db/schema/issues';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async getLiveStatus(
    currentUser: { id: string; isAdmin: boolean },
    projectId?: string,
  ) {
    let filterProjectIds: string[] | null = null;

    if (projectId) {
      if (!currentUser.isAdmin) {
        const [membership] = await this.db
          .select()
          .from(projectMemberships)
          .where(
            and(
              eq(projectMemberships.projectId, projectId),
              eq(projectMemberships.userId, currentUser.id),
            ),
          )
          .limit(1);

        if (!membership || membership.role !== 'manager') {
          throw new ForbiddenException(
            'Hanya Manager proyek ini atau Admin yang dapat melihat status live user',
          );
        }
      }
      filterProjectIds = [projectId];
    } else if (!currentUser.isAdmin) {
      const managed = await this.db
        .select({ projectId: projectMemberships.projectId })
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.userId, currentUser.id),
            eq(projectMemberships.role, 'manager'),
          ),
        );

      filterProjectIds = managed.map((m: any) => m.projectId);
      if (!filterProjectIds || filterProjectIds.length === 0) {
        return [];
      }
    }

    const userConditions: any[] = [];
    if (filterProjectIds && filterProjectIds.length > 0) {
      const memberUsers = await this.db
        .selectDistinct({ userId: projectMemberships.userId })
        .from(projectMemberships)
        .where(inArray(projectMemberships.projectId, filterProjectIds));

      const userIds = memberUsers.map((m: any) => m.userId);
      if (userIds.length === 0) return [];
      userConditions.push(inArray(user.id, userIds));
    }

    const rows = await this.db
      .select({
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.image,
        email: user.email,
        position: user.position,
        rawStatus: userLiveStatus.status,
        projectId: userLiveStatus.projectId,
        projectName: projects.name,
        projectKey: projects.key,
        issueId: userLiveStatus.issueId,
        issueTitle: issues.title,
        issueNumber: issues.number,
        lastHeartbeatAt: userLiveStatus.lastHeartbeatAt,
      })
      .from(user)
      .leftJoin(userLiveStatus, eq(user.id, userLiveStatus.userId))
      .leftJoin(projects, eq(userLiveStatus.projectId, projects.id))
      .leftJoin(issues, eq(userLiveStatus.issueId, issues.id))
      .where(userConditions.length > 0 ? and(...userConditions) : undefined);

    const STALE_THRESHOLD_MS = 3 * 60 * 1000;
    const now = new Date().getTime();

    return rows.map((r: any) => {
      let status: 'active' | 'idle' | 'offline' = r.rawStatus || 'offline';
      const lastHeartbeat = r.lastHeartbeatAt
        ? new Date(r.lastHeartbeatAt).getTime()
        : 0;

      if (
        status !== 'offline' &&
        (!r.lastHeartbeatAt || now - lastHeartbeat > STALE_THRESHOLD_MS)
      ) {
        status = 'offline';
      }

      const issueKey =
        status !== 'offline' && r.projectKey && r.issueNumber
          ? `${r.projectKey as string}-${r.issueNumber as number}`
          : null;

      return {
        userId: r.userId,
        name: r.name,
        username: r.username,
        avatar: r.avatar,
        email: r.email,
        position: r.position || null,
        status,
        projectId: status !== 'offline' ? r.projectId || null : null,
        projectName: status !== 'offline' ? r.projectName || null : null,
        issueId: status !== 'offline' ? r.issueId || null : null,
        issueTitle: status !== 'offline' ? r.issueTitle || null : null,
        issueKey,
        lastHeartbeatAt: r.lastHeartbeatAt || null,
      };
    });

  }

  async getActivityRanking(
    currentUser: { id: string; isAdmin: boolean },
    _period: 'week' | 'month' = 'week',
    projectId?: string,
  ) {
    return this.getLiveStatus(currentUser, projectId);
  }


  private formatDateString(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  async getReportData(
    projectId?: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    // 1. Fetch Time Blocks
    const blockConditions: any[] = [eq(timeBlocks.isDeleted, false)];
    if (projectId) blockConditions.push(eq(timeBlocks.projectId, projectId));
    if (userId) blockConditions.push(eq(timeBlocks.userId, userId));
    if (startDate)
      blockConditions.push(gte(timeBlocks.blockStart, new Date(startDate)));
    if (endDate)
      blockConditions.push(
        lte(timeBlocks.blockEnd, new Date(endDate + 'T23:59:59.999Z')),
      );

    const blocks = await this.db
      .select({
        id: timeBlocks.id,
        userName: user.name,
        userEmail: user.email,
        projectName: projects.name,
        issueTitle: issues.title,
        note: timeBlocks.note,
        blockStart: timeBlocks.blockStart,
        blockEnd: timeBlocks.blockEnd,
        isPaid: timeBlocks.isPaid,
      })
      .from(timeBlocks)
      .innerJoin(user, eq(timeBlocks.userId, user.id))
      .innerJoin(projects, eq(timeBlocks.projectId, projects.id))
      .leftJoin(issues, eq(timeBlocks.issueId, issues.id))
      .where(and(...blockConditions));

    // 2. Fetch Manual Time Entries
    const manualConditions: any[] = [
      eq(manualTimeEntries.approvalStatus, 'approved'),
    ];
    if (projectId)
      manualConditions.push(eq(manualTimeEntries.projectId, projectId));
    if (userId) manualConditions.push(eq(manualTimeEntries.userId, userId));
    if (startDate)
      manualConditions.push(gte(manualTimeEntries.entryDate, startDate));
    if (endDate)
      manualConditions.push(lte(manualTimeEntries.entryDate, endDate));

    const manuals = await this.db
      .select({
        id: manualTimeEntries.id,
        userName: user.name,
        userEmail: user.email,
        projectName: projects.name,
        issueTitle: issues.title,
        entryDate: manualTimeEntries.entryDate,
        durationMinutes: manualTimeEntries.durationMinutes,
        description: manualTimeEntries.description,
        approvalStatus: manualTimeEntries.approvalStatus,
      })
      .from(manualTimeEntries)
      .innerJoin(user, eq(manualTimeEntries.userId, user.id))
      .innerJoin(projects, eq(manualTimeEntries.projectId, projects.id))
      .leftJoin(issues, eq(manualTimeEntries.issueId, issues.id))
      .where(
        manualConditions.length > 0 ? and(...manualConditions) : undefined,
      );

    // 3. Format & Combine Data
    const formattedData: any[] = [];
    let totalMinutes = 0;

    for (const b of blocks) {
      const diffMs =
        new Date(b.blockEnd).getTime() - new Date(b.blockStart).getTime();
      const minutes = Math.round(diffMs / 60000);
      totalMinutes += minutes;

      formattedData.push({
        date: this.formatDateString(new Date(b.blockStart)),
        user: `${b.userName} (${b.userEmail})`,
        project: b.projectName,
        issue: b.issueTitle
          ? b.issueTitle
          : b.note
            ? `Activity: ${b.note}`
            : 'Activity',
        type: 'Automatic',
        durationMins: minutes,
        status: b.isPaid ? 'Paid' : 'Unpaid',
      });
    }

    for (const m of manuals) {
      totalMinutes += m.durationMinutes;
      formattedData.push({
        date: m.entryDate,
        user: `${m.userName} (${m.userEmail})`,
        project: m.projectName,
        issue: m.issueTitle
          ? m.issueTitle
          : m.description
            ? `Activity: ${m.description}`
            : 'Activity',
        type: 'Manual',
        durationMins: m.durationMinutes,
        status: m.approvalStatus.toUpperCase(),
      });
    }

    // Sort report rows chronologically
    formattedData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      rows: formattedData,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
    };
  }

  generateCsv(report: {
    rows: any[];
    totalMinutes: number;
    totalHours: string;
  }): string {
    let csv = 'Date,User,Project,Issue,Type,Duration (Mins),Status\n';
    for (const row of report.rows) {
      csv += `"${row.date}","${row.user}","${row.project}","${row.issue}","${row.type}",${row.durationMins},"${row.status}"\n`;
    }
    csv += `\nSummary:,,,,,,\n`;
    csv += `Total Minutes,,,,,${report.totalMinutes},\n`;
    csv += `Total Hours,,,,,${report.totalHours},\n`;
    return csv;
  }

  async generatePdf(report: {
    rows: any[];
    totalMinutes: number;
    totalHours: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: any) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: any) => reject(err));

      // --- Header Design ---
      doc
        .fillColor('#1e293b')
        .fontSize(22)
        .text('TrackFlow Work Hours Report', { align: 'center' });
      doc.moveDown(0.2);

      const generatedAt = new Date().toLocaleString();
      doc
        .fillColor('#64748b')
        .fontSize(10)
        .text(`Generated at: ${generatedAt}`, { align: 'center' });
      doc.moveDown(1.5);

      // --- Summary Cards ---
      const summaryTop = doc.y;
      doc.rect(50, summaryTop, 240, 60).fill('#f8fafc');
      doc
        .fillColor('#475569')
        .fontSize(10)
        .text('TOTAL MINUTES TRACKED', 65, summaryTop + 15);
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .text(String(report.totalMinutes), 65, summaryTop + 32);

      doc.rect(305, summaryTop, 240, 60).fill('#f8fafc');
      doc
        .fillColor('#475569')
        .fontSize(10)
        .text('TOTAL HOURS TRACKED', 320, summaryTop + 15);
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .text(`${report.totalHours} hrs`, 320, summaryTop + 32);
      doc.moveDown(4.5);

      // --- Table Headers ---
      doc.fontSize(12).fillColor('#1e293b').text('Detailed Log History', 50);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.rect(50, tableTop, 495, 20).fill('#0f172a');

      doc.fillColor('#ffffff').fontSize(9);
      doc.text('Date', 55, tableTop + 6, { width: 60 });
      doc.text('User', 120, tableTop + 6, { width: 120 });
      doc.text('Project', 245, tableTop + 6, { width: 90 });
      doc.text('Type', 340, tableTop + 6, { width: 60 });
      doc.text('Mins', 415, tableTop + 6, { width: 40, align: 'right' });
      doc.text('Status', 465, tableTop + 6, { width: 75, align: 'right' });

      let currentY = tableTop + 20;
      let stripe = false;

      // --- Table Rows ---
      for (const row of report.rows) {
        // Automatic page break check
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          doc.rect(50, currentY, 495, 20).fill('#0f172a');
          doc.fillColor('#ffffff').fontSize(9);
          doc.text('Date', 55, currentY + 6, { width: 60 });
          doc.text('User', 120, currentY + 6, { width: 120 });
          doc.text('Project', 245, currentY + 6, { width: 90 });
          doc.text('Type', 340, currentY + 6, { width: 60 });
          doc.text('Mins', 415, currentY + 6, { width: 40, align: 'right' });
          doc.text('Status', 465, currentY + 6, { width: 75, align: 'right' });
          currentY += 20;
        }

        if (stripe) {
          doc.rect(50, currentY, 495, 20).fill('#f8fafc');
        }
        doc.fillColor('#334155').fontSize(8);
        doc.text(row.date, 55, currentY + 6, { width: 60 });
        doc.text(
          row.user.length > 22 ? row.user.substring(0, 22) + '..' : row.user,
          120,
          currentY + 6,
          { width: 120 },
        );
        doc.text(
          row.project.length > 18
            ? row.project.substring(0, 18) + '..'
            : row.project,
          245,
          currentY + 6,
          { width: 90 },
        );
        doc.text(row.type, 340, currentY + 6, { width: 60 });
        doc.text(String(row.durationMins), 415, currentY + 6, {
          width: 40,
          align: 'right',
        });
        doc.text(row.status, 465, currentY + 6, { width: 75, align: 'right' });

        currentY += 20;
        stripe = !stripe;
      }

      doc.end();
    });
  }
}
