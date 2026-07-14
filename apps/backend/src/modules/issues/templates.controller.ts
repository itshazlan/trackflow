import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// 1. Global Templates Controller
@Controller('templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findGlobal() {
    return this.templatesService.findGlobal();
  }

  @Post()
  @UseGuards(AdminGuard)
  createGlobal(@Body() createTemplateDto: CreateTemplateDto) {
    createTemplateDto.projectId = null; // force global
    return this.templatesService.create(createTemplateDto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  updateGlobal(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  removeGlobal(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}

// 2. Project-level Templates Controller
@Controller([
  'projects/:projectId/templates',
  'projects/:projectId/issue-templates',
])
@UseGuards(AuthGuard, ProjectRoleGuard)
export class ProjectTemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAllForProject(@Param('projectId') projectId: string) {
    return this.templatesService.findAllForProject(projectId);
  }

  @Post()
  @Roles('manager')
  createProjectTemplate(
    @Param('projectId') projectId: string,
    @Body() createTemplateDto: CreateTemplateDto,
  ) {
    createTemplateDto.projectId = projectId; // force project-level
    return this.templatesService.create(createTemplateDto);
  }

  @Patch(':id')
  @Roles('manager')
  async updateProjectTemplate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    // Verify template belongs to the project before updating
    const template = await this.templatesService.findOne(id);
    if (template.projectId !== projectId) {
      throw new ForbiddenException('Template does not belong to this project');
    }
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @Roles('manager')
  async removeProjectTemplate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    // Verify template belongs to the project before deleting
    const template = await this.templatesService.findOne(id);
    if (template.projectId !== projectId) {
      throw new ForbiddenException('Template does not belong to this project');
    }
    return this.templatesService.remove(id);
  }
}
