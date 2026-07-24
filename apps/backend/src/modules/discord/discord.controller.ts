import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DiscordService } from './discord.service';
import { SaveDiscordWebhookDto } from './dto/save-discord-webhook.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/integrations/discord')
@UseGuards(AuthGuard, AdminGuard)
export class AdminDiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Get()
  getAppWebhook() {
    return this.discordService.getAppWebhook();
  }

  @Post()
  saveAppWebhook(@Body() dto: SaveDiscordWebhookDto, @Req() req: any) {
    return this.discordService.saveAppWebhook(dto, req.user.id);
  }

  @Delete()
  deleteAppWebhook() {
    return this.discordService.deleteAppWebhook();
  }

  @Post('test')
  testAppWebhook() {
    return this.discordService.testAppWebhook();
  }
}

@Controller('projects/:projectId/integrations/discord')
@UseGuards(AuthGuard, ProjectRoleGuard)
@Roles('manager')
export class ProjectDiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Get()
  @Roles('manager')
  getProjectWebhook(@Param('projectId') projectId: string) {
    return this.discordService.getProjectWebhook(projectId);
  }

  @Post()
  @Roles('manager')
  saveProjectWebhook(
    @Param('projectId') projectId: string,
    @Body() dto: SaveDiscordWebhookDto,
    @Req() req: any,
  ) {
    return this.discordService.saveProjectWebhook(projectId, dto, req.user.id);
  }

  @Delete()
  @Roles('manager')
  deleteProjectWebhook(@Param('projectId') projectId: string) {
    return this.discordService.deleteProjectWebhook(projectId);
  }

  @Post('test')
  @Roles('manager')
  testProjectWebhook(@Param('projectId') projectId: string) {
    return this.discordService.testProjectWebhook(projectId);
  }
}
