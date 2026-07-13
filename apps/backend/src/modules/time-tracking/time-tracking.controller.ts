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
  UseInterceptors, 
  UploadedFile,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TimeTrackingService } from './time-tracking.service';
import { SyncTimeBlockDto } from './dto/sync-time-block.dto';
import { OverrideTimeBlockDto, SelfDeleteTimeBlockDto } from './dto/override-time-block.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('time-blocks')
@UseGuards(AuthGuard)
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post('sync')
  sync(@Body() syncTimeBlockDto: SyncTimeBlockDto, @Req() req: any) {
    return this.timeTrackingService.sync(syncTimeBlockDto, req.user);
  }

  @Post(':id/screenshot')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/screenshots',
        filename: (req: any, file: any, cb: any) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadScreenshot(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.timeTrackingService.saveScreenshot(id, file.path, new Date().toISOString());
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.timeTrackingService.findAllForUser(req.user.id, projectId, startDate, endDate);
  }

  @Delete(':id')
  selfDelete(
    @Param('id') id: string,
    @Body() dto: SelfDeleteTimeBlockDto,
    @Req() req: any
  ) {
    return this.timeTrackingService.selfDelete(id, req.user.id, dto.reason);
  }

  @Post(':id/override')
  @UseGuards(AdminGuard)
  override(
    @Param('id') id: string,
    @Body() dto: OverrideTimeBlockDto,
    @Req() req: any
  ) {
    return this.timeTrackingService.adminOverride(id, req.user.id, dto.action, dto.reason);
  }
}
