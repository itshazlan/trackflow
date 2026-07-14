import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingController } from './time-tracking.controller';
import { R2Service } from './r2.service';

@Module({
  imports: [DbModule],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService, R2Service],
  exports: [TimeTrackingService, R2Service],
})
export class TimeTrackingModule {}
