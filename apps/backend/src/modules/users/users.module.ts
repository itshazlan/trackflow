import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';

@Module({
  imports: [DbModule, TimeTrackingModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
