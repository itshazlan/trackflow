import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DbModule } from '../../db/db.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [DbModule, DiscordModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}

