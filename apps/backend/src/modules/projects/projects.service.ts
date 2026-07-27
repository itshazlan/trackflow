import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, isNull, count, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projects, projectMemberships } from '../../db/schema/projects';
import { issues, issueStatuses } from '../../db/schema/issues';
import { user } from '../../db/schema/auth';
import { CreateProjectDto } from './dto/create-project.dto';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly discordService: DiscordService,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    let createdProject: any;
    try {
      const normalizedKey = createProjectDto.key.toUpperCase();
      createdProject = await this.db.transaction(async (tx: any) => {
        // 0. Check if key is already taken
        const [existing] = await tx
          .select()
          .from(projects)
          .where(eq(projects.key, normalizedKey))
          .limit(1);

        if (existing) {
          throw new BadRequestException(`Project key "${normalizedKey}" is already taken`);
        }

        // 1. Insert project
        const [newProject] = await tx
          .insert(projects)
          .values({
            name: createProjectDto.name,
            key: normalizedKey,
            description: createProjectDto.description,
            parentProjectId: createProjectDto.parentProjectId,
            createdBy: userId,
          })
          .returning();

        // 2. Add members directly to the project (including creator fallback if not listed)
        const inputMembers = createProjectDto.members || [];
        const uniqueMembersMap = new Map<string, string>();
        for (const m of inputMembers) {
          if (!uniqueMembersMap.has(m.userId)) {
            uniqueMembersMap.set(m.userId, m.role);
          }
        }

        if (!uniqueMembersMap.has(userId)) {
          uniqueMembersMap.set(userId, 'manager');
        }

        for (const [memberUserId, role] of uniqueMembersMap.entries()) {
          await tx.insert(projectMemberships).values({
            projectId: newProject.id,
            userId: memberUserId,
            role: role,
          });
        }

        // 3. Seed default issue statuses (FR-022)
        const defaultStatuses = [
          { name: 'New', orderIndex: 0, restrictedToRole: null, isFinal: false },
          { name: 'In Progress', orderIndex: 1, restrictedToRole: null, isFinal: false },
          { name: 'Testing', orderIndex: 2, restrictedToRole: null, isFinal: false },
          { name: 'Ready to Deploy', orderIndex: 3, restrictedToRole: null, isFinal: false },
          { name: 'Blocker', orderIndex: 4, restrictedToRole: null, isFinal: false },
          { name: 'Done', orderIndex: 5, restrictedToRole: 'reporter_qa', isFinal: true },
        ];

        for (const status of defaultStatuses) {
          await tx.insert(issueStatuses).values({
            projectId: newProject.id,
            name: status.name,
            orderIndex: status.orderIndex,
            restrictedToRole: status.restrictedToRole,
            isFinal: status.isFinal,
          });
        }

        return newProject;
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      console.error('[ProjectsService.create Error]:', err);
      throw new InternalServerErrorException('Failed to create project');
    }

    // Fire-and-Forget notification to Discord (non-blocking)
    if (createdProject) {
      this.discordService.notifyDiscordProjectCreated(createdProject);
    }

    return createdProject;
  }

  async findAll(user: { id: string; isAdmin: boolean }) {
    let resultProjects: any[];
    if (user.isAdmin) {
      // Admins see all projects
      resultProjects = await this.db.select().from(projects);
    } else {
      // Normal users only see projects they are members of
      resultProjects = await this.db
        .select({
          id: projects.id,
          name: projects.name,
          key: projects.key,
          description: projects.description,
          parentProjectId: projects.parentProjectId,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          archivedAt: projects.archivedAt,
          archivedBy: projects.archivedBy,
        })
        .from(projects)
        .innerJoin(
          projectMemberships,
          eq(projects.id, projectMemberships.projectId),
        )
        .where(eq(projectMemberships.userId, user.id));
    }

    if (!resultProjects || resultProjects.length === 0) {
      return [];
    }

    const projectIds = resultProjects.map((p: any) => p.id);

    const stats = await this.db
      .select({
        projectId: issues.projectId,
        total: count(),
        completed: count(sql`CASE WHEN ${issueStatuses.isFinal} THEN 1 END`),
      })
      .from(issues)
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(inArray(issues.projectId, projectIds))
      .groupBy(issues.projectId);

    const statsMap = new Map<string, { total: number; completed: number }>();
    stats.forEach((s: any) => {
      statsMap.set(s.projectId, {
        total: Number(s.total || 0),
        completed: Number(s.completed || 0),
      });
    });

    return resultProjects.map((p: any) => ({
      ...p,
      parent_project_id: p.parentProjectId,
      issueStats: statsMap.get(p.id) || { total: 0, completed: 0 },
    }));
  }

  async findOne(id: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async findSubProjects(parentId: string) {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.parentProjectId, parentId));
  }

  async update(id: string, updateProjectDto: Partial<CreateProjectDto>) {
    if (updateProjectDto.key) {
      throw new BadRequestException('Project key is immutable and cannot be updated');
    }

    const [updated] = await this.db
      .update(projects)
      .set(updateProjectDto)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return updated;
  }

  async checkKeyExists(key: string): Promise<boolean> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.key, key.toUpperCase()))
      .limit(1);
    return !!project;
  }

  async archive(projectId: string, userId: string) {
    const activeSubProjects = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.parentProjectId, projectId),
          isNull(projects.archivedAt),
        ),
      );

    if (activeSubProjects.length > 0) {
      throw new BadRequestException(
        'Arsipkan seluruh sub-proyek terlebih dahulu sebelum mengarsipkan proyek induk',
      );
    }

    const [updated] = await this.db
      .update(projects)
      .set({ archivedAt: new Date(), archivedBy: userId })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return updated;
  }

  async restore(projectId: string) {
    const [updated] = await this.db
      .update(projects)
      .set({ archivedAt: null, archivedBy: null })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return updated;
  }

  async getWorkload(projectId: string) {
    await this.findOne(projectId);

    // 1. Get all members of the project
    const membersList = await this.db
      .select({
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.image,
        role: projectMemberships.role,
      })
      .from(projectMemberships)
      .innerJoin(user, eq(projectMemberships.userId, user.id))
      .where(eq(projectMemberships.projectId, projectId));

    // 2. Get all project issues with status and due date info
    const todayStr = new Date().toISOString().split('T')[0];

    const projectIssues = await this.db
      .select({
        id: issues.id,
        assigneeId: issues.assigneeId,
        statusId: issues.statusId,
        dueDate: issues.dueDate,
        isFinal: issueStatuses.isFinal,
      })
      .from(issues)
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(eq(issues.projectId, projectId));

    // 3. Aggregate per member
    const members = membersList.map((m: any) => {
      const assigned = projectIssues.filter((i: any) => i.assigneeId === m.userId);

      const byStatus: Record<string, number> = {};
      let overdueCount = 0;

      assigned.forEach((i: any) => {
        byStatus[i.statusId] = (byStatus[i.statusId] || 0) + 1;
        if (i.dueDate && i.dueDate.split('T')[0] < todayStr && !i.isFinal) {
          overdueCount++;
        }
      });

      return {
        userId: m.userId,
        name: m.name,
        username: m.username,
        avatar: m.avatar,
        role: m.role,
        totalAssigned: assigned.length,
        byStatus,
        overdueCount,
      };
    });

    return { members };
  }

  async hardDelete(projectId: string, confirmKey: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (project.key !== confirmKey) {
      throw new BadRequestException('Kode proyek tidak sesuai — hapus dibatalkan');
    }

    const [deleted] = await this.db
      .delete(projects)
      .where(eq(projects.id, projectId))
      .returning();

    return { message: 'Project deleted successfully', deleted };
  }
}
