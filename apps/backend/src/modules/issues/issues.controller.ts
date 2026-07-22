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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IssuesService } from './issues.service';
import {
  CreateIssueDto,
  UpdateIssueDto,
  UpdateIssueStatusDto,
} from './dto/issue.dto';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CreateCommentAttachmentDto,
  ConfirmCommentAttachmentDto,
  CreateCommentImageDto,
  ConfirmCommentImageDto,
} from './dto/comment.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
    }),
  )
  async createAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File tidak ditemukan dalam request.');
    }

    // Decode filename from Latin-1 to UTF-8 to handle Multer encoding issues,
    // normalize and sanitize spaces to prevent loading/serving issues.
    const decodedName = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .normalize('NFC')
      .replace(/[\u202F\u00A0]/g, ' ');

    return this.issuesService.createAttachment(
      id,
      decodedName,
      file.mimetype,
      file.buffer,
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

  @Get(':id/comments')
  findComments(@Param('id') id: string, @Req() req: any) {
    return this.issuesService.findCommentsForIssue(id, req.user.id);
  }

  @Post(':id/comments')
  createComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.issuesService.createComment(
      id,
      createCommentDto,
      req.user.id,
    );
  }

  @Patch(':id/comments/:commentId')
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() req: any,
  ) {
    return this.issuesService.updateComment(
      id,
      commentId,
      updateCommentDto,
      req.user.id,
    );
  }

  @Delete(':id/comments/:commentId')
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.issuesService.removeComment(
      id,
      commentId,
      req.user.id,
      req.user.isAdmin,
    );
  }

  @Post(':id/comments/:commentId/attachments')
  createCommentAttachmentPresignedUrl(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() createAttachmentDto: CreateCommentAttachmentDto,
    @Req() req: any,
  ) {
    return this.issuesService.createCommentAttachmentPresignedUrl(
      id,
      commentId,
      createAttachmentDto,
      req.user.id,
    );
  }

  @Post(':id/comments/:commentId/attachments/:attachmentId/confirm')
  confirmCommentAttachmentUpload(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() confirmDto: ConfirmCommentAttachmentDto,
    @Req() req: any,
  ) {
    return this.issuesService.confirmCommentAttachmentUpload(
      id,
      commentId,
      attachmentId,
      confirmDto,
      req.user.id,
    );
  }

  @Get(':id/comments/:commentId/attachments/:attachmentId/download')
  getCommentAttachmentDownloadUrl(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.issuesService.getCommentAttachmentDownloadUrl(
      id,
      commentId,
      attachmentId,
      req.user.id,
    );
  }

  // Backwards compatibility aliases for /images
  @Post(':id/comments/:commentId/images')
  createCommentImagePresignedUrl(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() createImageDto: CreateCommentImageDto,
    @Req() req: any,
  ) {
    return this.createCommentAttachmentPresignedUrl(id, commentId, createImageDto, req);
  }

  @Post(':id/comments/:commentId/images/:imageId/confirm')
  confirmCommentImageUpload(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Param('imageId') imageId: string,
    @Body() confirmDto: ConfirmCommentImageDto,
    @Req() req: any,
  ) {
    return this.confirmCommentAttachmentUpload(id, commentId, imageId, confirmDto, req);
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
      req.user.isAdmin,
      req.projectRole,
    );
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.issuesService.remove(projectId, id);
  }
}
