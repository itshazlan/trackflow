import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DbModule, NotificationsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
