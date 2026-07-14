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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Req() req: any) {
    return this.projectsService.create(createProjectDto, req.user.id);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.projectsService.findAll(req.user);
  }

  @Get('check-key/:key')
  async checkKey(@Param('key') key: string) {
    const exists = await this.projectsService.checkKeyExists(key);
    return { available: !exists };
  }

  @Get(':id')
  @UseGuards(ProjectRoleGuard)
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get([':id/subprojects', ':id/sub-projects'])
  @UseGuards(ProjectRoleGuard)
  findSubProjects(@Param('id') id: string) {
    return this.projectsService.findSubProjects(id);
  }

  @Post([':id/subprojects', ':id/sub-projects'])
  @UseGuards(ProjectRoleGuard)
  @Roles('manager')
  createSubProject(
    @Param('id') id: string,
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: any,
  ) {
    const dtoWithParent = { ...createProjectDto, parentProjectId: id };
    return this.projectsService.create(dtoWithParent, req.user.id);
  }

  @Patch(':id')
  @UseGuards(ProjectRoleGuard)
  @Roles('manager')
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: Partial<CreateProjectDto>,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @Roles('manager')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
