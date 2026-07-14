import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { SyncTimeBlockDto } from './dto/sync-time-block.dto';
import {
  OverrideTimeBlockDto,
  SelfDeleteTimeBlockDto,
} from './dto/override-time-block.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('time-blocks')
@UseGuards(AuthGuard)
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post('sync')
  sync(@Body() syncTimeBlockDto: SyncTimeBlockDto, @Req() req: any) {
    return this.timeTrackingService.sync(syncTimeBlockDto, req.user);
  }

  @Post(':id/screenshot')
  uploadScreenshot(@Param('id') id: string) {
    return this.timeTrackingService.getScreenshotUploadUrl(id);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeTrackingService.findAllForUser(
      req.user.id,
      projectId,
      startDate,
      endDate,
    );
  }

  @Delete(':id')
  selfDelete(
    @Param('id') id: string,
    @Body() dto: SelfDeleteTimeBlockDto,
    @Req() req: any,
  ) {
    return this.timeTrackingService.selfDelete(id, req.user.id, dto.reason);
  }

  @Post(':id/override')
  @UseGuards(AdminGuard)
  override(
    @Param('id') id: string,
    @Body() dto: OverrideTimeBlockDto,
    @Req() req: any,
  ) {
    return this.timeTrackingService.adminOverride(
      id,
      req.user.id,
      dto.action,
      dto.reason,
    );
  }
}
