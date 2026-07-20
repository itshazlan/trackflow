import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { RequestFileUploadDto } from './dto/request-file-upload.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Controller('projects/:projectId/documents')
@UseGuards(AuthGuard, ProjectRoleGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // 1. GET /projects/:projectId/documents (List all containers, supports pagination)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.documentsService.findAll(projectId, page, limit);
  }

  // 2. POST /projects/:projectId/documents (Create container)
  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateContainerDto,
    @Req() req: any,
  ) {
    return this.documentsService.create(projectId, dto, req.user);
  }

  // 3. GET /projects/:projectId/documents/:documentId (Detail container + files)
  @Get(':documentId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.findOne(projectId, documentId);
  }

  // 4. PATCH /projects/:projectId/documents/:documentId (Update container metadata)
  @Patch(':documentId')
  update(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateContainerDto,
    @Req() req: any,
  ) {
    return this.documentsService.update(projectId, documentId, dto, req.user, req.projectRole);
  }

  // 5. DELETE /projects/:projectId/documents/:documentId (Delete container + R2 objects cascade)
  @Delete(':documentId')
  remove(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
  ) {
    return this.documentsService.remove(projectId, documentId, req.user, req.projectRole);
  }

  // 6. POST /projects/:projectId/documents/:documentId/files (Request pre-signed upload URL)
  @Post(':documentId/files')
  requestFileUpload(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() dto: RequestFileUploadDto,
    @Req() req: any,
  ) {
    return this.documentsService.requestFileUpload(projectId, documentId, dto, req.user);
  }

  // 7. POST /projects/:projectId/documents/:documentId/files/:fileId/confirm (Confirm file upload)
  @Post(':documentId/files/:fileId/confirm')
  @HttpCode(HttpStatus.OK)
  confirmFileUpload(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    return this.documentsService.confirmFileUpload(projectId, documentId, fileId, req.user);
  }

  // 8. GET /projects/:projectId/documents/:documentId/files/:fileId/download (Get download URL)
  @Get(':documentId/files/:fileId/download')
  getFileDownloadUrl(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.documentsService.getFileDownloadUrl(projectId, documentId, fileId);
  }

  // 9. DELETE /projects/:projectId/documents/:documentId/files/:fileId (Delete single file + R2 object)
  @Delete(':documentId/files/:fileId')
  removeFile(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    return this.documentsService.removeFile(projectId, documentId, fileId, req.user, req.projectRole);
  }
}
