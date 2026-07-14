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
import { MembershipsService } from './memberships.service';
import {
  AddMembershipDto,
  UpdateMembershipDto,
} from './dto/add-membership.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('projects/:projectId/members')
@UseGuards(AuthGuard, ProjectRoleGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles('manager')
  addMember(
    @Param('projectId') projectId: string,
    @Body() addMembershipDto: AddMembershipDto,
  ) {
    return this.membershipsService.addMember(
      projectId,
      addMembershipDto.userId,
      addMembershipDto.role,
    );
  }

  @Get()
  getMembers(@Param('projectId') projectId: string) {
    return this.membershipsService.getMembers(projectId);
  }

  @Patch(':userId')
  @Roles('manager')
  updateRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() updateMembershipDto: UpdateMembershipDto,
  ) {
    return this.membershipsService.updateRole(
      projectId,
      userId,
      updateMembershipDto.role,
    );
  }

  @Delete(':userId')
  @Roles('manager')
  removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.membershipsService.removeMember(projectId, userId);
  }
}
