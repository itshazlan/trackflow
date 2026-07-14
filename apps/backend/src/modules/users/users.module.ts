import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DbModule } from '../../db/db.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';

@Module({
  imports: [
    DbModule,
    TimeTrackingModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
