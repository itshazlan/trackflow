import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DbModule } from '../../db/db.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [DbModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})

export class NotificationsModule {}
