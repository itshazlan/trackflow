import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';

@Module({
  imports: [DbModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
