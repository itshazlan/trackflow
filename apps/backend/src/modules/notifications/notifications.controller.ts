import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('unread') unread?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const unreadOnly = unread === 'true';
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.getNotifications(
      req.user.id,
      unreadOnly,
      pageNum,
      limitNum,
    );
  }

  @Patch('read-all')
  async readAll(@Req() req: any) {
    return this.notificationsService.readAll(req.user.id);
  }

  @Patch(':id/read')
  async readNotification(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.readNotification(req.user.id, id);
  }
}
