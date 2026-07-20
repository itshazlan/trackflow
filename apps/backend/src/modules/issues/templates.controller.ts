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
  Req,
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
    // Allow managers to set projectId to null to make it public/global
    if (createTemplateDto.projectId !== null) {
      createTemplateDto.projectId = projectId;
    }
    return this.templatesService.create(createTemplateDto);
  }

  @Patch(':id')
  @Roles('manager')
  async updateProjectTemplate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Req() req: any,
  ) {
    // Verify template belongs to the project before updating, unless user is Admin
    const template = await this.templatesService.findOne(id);
    const isAdmin = req.user?.isAdmin;
    if (template.projectId !== projectId && !isAdmin) {
      throw new ForbiddenException('Template does not belong to this project');
    }
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @Roles('manager')
  async removeProjectTemplate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    // Verify template belongs to the project before deleting, unless user is Admin
    const template = await this.templatesService.findOne(id);
    const isAdmin = req.user?.isAdmin;
    if (template.projectId !== projectId && !isAdmin) {
      throw new ForbiddenException('Template does not belong to this project');
    }
    return this.templatesService.remove(id);
  }
}
