import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { StatusesService } from './statuses.service';
import {
  CreateStatusDto,
  UpdateStatusDto,
  ReorderStatusesDto,
} from './dto/status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('projects/:projectId/statuses')
@UseGuards(AuthGuard, ProjectRoleGuard)
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Get()
  findAllForProject(@Param('projectId') projectId: string) {
    return this.statusesService.findAllForProject(projectId);
  }

  @Post()
  @Roles('manager')
  create(
    @Param('projectId') projectId: string,
    @Body() createStatusDto: CreateStatusDto,
  ) {
    return this.statusesService.create(projectId, createStatusDto);
  }

  @Post('reorder')
  @Roles('manager')
  reorder(
    @Param('projectId') projectId: string,
    @Body() reorderStatusesDto: ReorderStatusesDto,
  ) {
    return this.statusesService.reorder(
      projectId,
      reorderStatusesDto.statusIds,
    );
  }

  @Patch(':id')
  @Roles('manager')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.statusesService.update(projectId, id, updateStatusDto);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.statusesService.remove(projectId, id);
  }
}
