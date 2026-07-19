import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projectMemberships, projects } from '../../db/schema/projects';
import { user } from '../../db/schema/auth';
import { ProjectRole } from '@trackflow/shared-types';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MembershipsService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly notificationsService: NotificationsService,
  ) {}

  async addMember(projectId: string, userId: string, role: ProjectRole) {
    // 1. Verify user exists
    const [existingUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // 2. Check if already member
    const [existingMember] = await this.db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (existingMember) {
      throw new ConflictException('User is already a member of this project');
    }

    // 3. Add member
    const [newMembership] = await this.db
      .insert(projectMemberships)
      .values({
        projectId,
        userId,
        role,
      })
      .returning();

    // Fetch project details for the notification
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project) {
      await this.notificationsService.createNotification({
        userId,
        type: 'project_member_added',
        title: 'Ditambahkan ke Proyek',
        body: `Anda telah ditambahkan sebagai member di proyek "${project.name}" dengan peran "${role}"`,
        entityType: 'project',
        entityId: projectId,
      });
    }

    return newMembership;
  }


  async getMembers(projectId: string) {
    return this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        image: user.image,
        role: projectMemberships.role,
        invitedAt: projectMemberships.invitedAt,
      })
      .from(projectMemberships)
      .innerJoin(user, eq(projectMemberships.userId, user.id))
      .where(eq(projectMemberships.projectId, projectId));
  }

  async updateRole(projectId: string, userId: string, newRole: ProjectRole) {
    const [existingMember] = await this.db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (!existingMember) {
      throw new NotFoundException('Membership not found');
    }

    // Check manager removal safeguard: if the current role is manager, and we are demoting them,
    // verify they are not the sole manager of the project.
    if (existingMember.role === 'manager' && newRole !== 'manager') {
      const managers = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.role, 'manager'),
          ),
        );

      if (managers.length <= 1) {
        throw new BadRequestException('Cannot demote the sole project manager');
      }
    }

    const [updated] = await this.db
      .update(projectMemberships)
      .set({ role: newRole })
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async removeMember(projectId: string, userId: string) {
    const [existingMember] = await this.db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (!existingMember) {
      throw new NotFoundException('Membership not found');
    }

    // Safegard: Cannot remove the sole manager
    if (existingMember.role === 'manager') {
      const managers = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.role, 'manager'),
          ),
        );

      if (managers.length <= 1) {
        throw new BadRequestException('Cannot remove the sole project manager');
      }
    }

    const [deleted] = await this.db
      .delete(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .returning();

    return { message: 'Member removed successfully', deleted };
  }
}
