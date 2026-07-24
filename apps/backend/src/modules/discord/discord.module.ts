import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import {
  AdminDiscordController,
  ProjectDiscordController,
} from './discord.controller';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [AdminDiscordController, ProjectDiscordController],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
