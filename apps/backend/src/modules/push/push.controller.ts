import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PushService } from './push.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/push.dto';

@Controller('push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.pushService.getVapidPublicKey();
  }

  @Post('subscribe')
  async subscribe(@Req() req: any, @Body() dto: SubscribePushDto) {
    const userAgentHeader = req.headers['user-agent'];
    return this.pushService.subscribe(req.user.id, dto, userAgentHeader);
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Req() req: any, @Body() dto: UnsubscribePushDto) {
    return this.pushService.unsubscribe(req.user.id, dto.endpoint);
  }
}
