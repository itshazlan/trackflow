import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TrackersService } from './trackers.service';
import { TrackersController } from './trackers.controller';
import { StatusesService } from './statuses.service';
import { StatusesController } from './statuses.controller';
import { TemplatesService } from './templates.service';
import { TemplatesController, ProjectTemplatesController } from './templates.controller';

@Module({
  imports: [DbModule],
  controllers: [
    TrackersController,
    StatusesController,
    TemplatesController,
    ProjectTemplatesController,
  ],
  providers: [
    TrackersService,
    StatusesService,
    TemplatesService,
  ],
  exports: [
    TrackersService,
    StatusesService,
    TemplatesService,
  ],
})
export class IssuesModule {}
