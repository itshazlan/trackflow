import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('projects/:projectId/documents')
@UseGuards(AuthGuard, ProjectRoleGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.documentsService.findAll(projectId);
  }

  @Post()
  @Roles('manager', 'developer')
  create(
    @Param('projectId') projectId: string,
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.create(projectId, createDocumentDto, req.user);
  }

  @Post(':docId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    return this.documentsService.confirmUpload(projectId, docId);
  }

  @Get(':docId/download')
  getDownloadUrl(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    return this.documentsService.getDownloadUrl(projectId, docId);
  }

  @Delete(':docId')
  @Roles('manager', 'developer')
  remove(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
    @Req() req: any,
  ) {
    return this.documentsService.remove(projectId, docId, req.user, req.projectRole);
  }
}
