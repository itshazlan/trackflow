import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TrackersService } from './trackers.service';
import { TrackersController } from './trackers.controller';
import { StatusesService } from './statuses.service';
import { StatusesController } from './statuses.controller';
import { TemplatesService } from './templates.service';
import {
  TemplatesController,
  ProjectTemplatesController,
} from './templates.controller';
import { IssuesService } from './issues.service';
import { UserIssuesController, IssuesController } from './issues.controller';

@Module({
  imports: [DbModule],
  controllers: [
    TrackersController,
    StatusesController,
    TemplatesController,
    ProjectTemplatesController,
    UserIssuesController,
    IssuesController,
  ],
  providers: [
    TrackersService,
    StatusesService,
    TemplatesService,
    IssuesService,
  ],
  exports: [TrackersService, StatusesService, TemplatesService, IssuesService],
})
export class IssuesModule {}
