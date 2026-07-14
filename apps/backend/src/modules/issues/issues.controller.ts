import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import {
  CreateIssueDto,
  UpdateIssueDto,
  UpdateIssueStatusDto,
} from './dto/issue.dto';
import { CreateAttachmentDto } from './dto/attachment.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// 1. User Dashboard Issues Controller
@Controller('issues')
@UseGuards(AuthGuard)
export class UserIssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  findAllForUser(@Req() req: any) {
    return this.issuesService.findAllForUser(req.user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateIssueStatusDto: UpdateIssueStatusDto,
    @Req() req: any,
  ) {
    return this.issuesService.updateStatus(
      id,
      updateIssueStatusDto.statusId,
      req.user.id,
    );
  }

  @Post(':id/attachments')
  createAttachment(
    @Param('id') id: string,
    @Body() createAttachmentDto: CreateAttachmentDto,
    @Req() req: any,
  ) {
    return this.issuesService.createAttachment(
      id,
      createAttachmentDto,
      req.user.id,
    );
  }

  @Get(':id/attachments')
  findAttachments(@Param('id') id: string, @Req() req: any) {
    return this.issuesService.findAttachmentsForIssue(id, req.user.id);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.issuesService.removeAttachment(
      id,
      attachmentId,
      req.user.id,
      req.user.isAdmin,
    );
  }
}

// 2. Project Issues Controller
@Controller('projects/:projectId/issues')
@UseGuards(AuthGuard, ProjectRoleGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() createIssueDto: CreateIssueDto,
    @Req() req: any,
  ) {
    return this.issuesService.create(projectId, createIssueDto, req.user.id);
  }

  @Get()
  findAllForProject(@Param('projectId') projectId: string) {
    return this.issuesService.findAllForProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateIssueDto: UpdateIssueDto,
    @Req() req: any,
  ) {
    return this.issuesService.update(
      projectId,
      id,
      updateIssueDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.issuesService.remove(projectId, id);
  }
}
