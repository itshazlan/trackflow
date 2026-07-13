import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { IssuesModule } from './modules/issues/issues.module';

@Module({
  imports: [
    DbModule, 
    AuthModule,
    ProjectsModule,
    MembershipsModule,
    IssuesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
