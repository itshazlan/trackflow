import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { CreateTimesheetDto, ApproveTimesheetDto } from './dto/timesheet.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projectMemberships } from '../../db/schema/projects';
import { eq, and } from 'drizzle-orm';

@Controller()
@UseGuards(AuthGuard)
export class TimesheetsController {
  constructor(
    private readonly timesheetsService: TimesheetsService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  // --- Manual Time Entries ---
  @Post('manual-time-entries')
  createManualEntry(@Body() dto: CreateManualEntryDto, @Req() req: any) {
    return this.timesheetsService.createManualEntry(dto, req.user.id);
  }

  @Get('manual-time-entries')
  findManualEntries(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.timesheetsService.findManualEntries(req.user.id, projectId);
  }

  // --- Timesheets ---
  @Post('timesheets')
  createTimesheet(@Body() dto: CreateTimesheetDto, @Req() req: any) {
    return this.timesheetsService.createTimesheet(dto, req.user.id);
  }

  @Get('timesheets')
  findTimesheets(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.timesheetsService.findTimesheets(req.user.id, projectId, req.user.isAdmin);
  }

  @Get('timesheets/:id')
  getTimesheetDetail(@Param('id') id: string, @Req() req: any) {
    return this.timesheetsService.getTimesheetDetail(
      id,
      req.user.id,
      req.user.isAdmin,
    );
  }

  @Post('timesheets/:id/submit')
  submitTimesheet(@Param('id') id: string, @Req() req: any) {
    return this.timesheetsService.submitTimesheet(id, req.user.id);
  }

  @Post('timesheets/:id/approve')
  async approveTimesheet(
    @Param('id') id: string,
    @Body() dto: ApproveTimesheetDto,
    @Req() req: any,
  ) {
    // 1. Fetch timesheet to find the projectId
    const tsDetail = await this.timesheetsService.getTimesheetDetail(
      id,
      req.user.id,
      req.user.isAdmin,
    );

    // 2. Resolve reviewer's role in this project
    let role = 'none';
    if (req.user.isAdmin) {
      role = 'admin';
    } else {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, tsDetail.projectId),
            eq(projectMemberships.userId, req.user.id),
          ),
        )
        .limit(1);

      if (membership) {
        role = membership.role;
      }
    }

    return this.timesheetsService.approveTimesheet(id, req.user.id, dto, role);
  }
}
