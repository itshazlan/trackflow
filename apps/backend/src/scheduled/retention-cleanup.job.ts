import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RetentionCleanupJob {
  private readonly logger = new Logger(RetentionCleanupJob.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCron() {
    this.logger.debug('Running retention cleanup job...');
    // TODO: Implement screenshot & time tracking data retention purge as specified in §13
  }
}
