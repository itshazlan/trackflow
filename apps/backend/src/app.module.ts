import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { IssuesModule } from './modules/issues/issues.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { UsersModule } from './modules/users/users.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    ProjectsModule,
    MembershipsModule,
    IssuesModule,
    TimeTrackingModule,
    TimesheetsModule,
    ReportsModule,
    AdminModule,
    UsersModule,
    RealtimeModule,
    NotificationsModule,
    DocumentsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
