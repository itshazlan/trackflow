import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projectMemberships } from '../../db/schema/projects';
import { ProjectRole } from '@trackflow/shared-types';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(DRIZZLE) private db: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // SDD §4.1: "Admin memiliki akses baca implisit ke semua proyek (tanpa perlu didaftarkan sebagai member), sehingga bisa memantau seluruh tim."
    // We extend this to allow Admin implicit manager role for all write operations as well.
    if (user.isAdmin) {
      request.projectRole = 'manager';
      return true;
    }

    const projectId = request.params.projectId || request.params.id;
    if (!projectId) {
      return false;
    }

    const membership = await this.db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, user.id),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException('Not a member of this project');
    }

    const userRole = membership[0].role as ProjectRole;
    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(userRole)
    ) {
      throw new ForbiddenException('Insufficient project permissions');
    }

    request.projectRole = userRole;
    return true;
  }
}
