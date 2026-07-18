import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projects, projectMemberships } from '../../db/schema/projects';
import { issueStatuses } from '../../db/schema/issues';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE) private db: any) { }

  async create(createProjectDto: CreateProjectDto, userId: string) {
    try {
      const normalizedKey = createProjectDto.key.toUpperCase();
      return await this.db.transaction(async (tx: any) => {
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

        // 2. Automatically make creator the 'manager' member of the project
        await tx.insert(projectMemberships).values({
          projectId: newProject.id,
          userId: userId,
          role: 'manager',
        });

        // 3. Seed default issue statuses (FR-022)
        const defaultStatuses = [
          { name: 'New', orderIndex: 0, restrictedToRole: null },
          { name: 'In Progress', orderIndex: 1, restrictedToRole: null },
          { name: 'Testing', orderIndex: 2, restrictedToRole: null },
          { name: 'Ready to Deploy', orderIndex: 3, restrictedToRole: null },
          { name: 'Blocker', orderIndex: 4, restrictedToRole: null },
          { name: 'Done', orderIndex: 5, restrictedToRole: 'reporter_qa' },
        ];

        for (const status of defaultStatuses) {
          await tx.insert(issueStatuses).values({
            projectId: newProject.id,
            name: status.name,
            orderIndex: status.orderIndex,
            restrictedToRole: status.restrictedToRole,
          });
        }

        return newProject;
      });
    } catch (err) {
      console.error('[ProjectsService.create Error]:', err);
      throw new InternalServerErrorException('Failed to create project');
    }
  }

  async findAll(user: { id: string; isAdmin: boolean }) {
    if (user.isAdmin) {
      // Admins see all projects
      const all = await this.db.select().from(projects);
      return all.map((p: any) => ({
        ...p,
        parent_project_id: p.parentProjectId,
      }));
    }

    // Normal users only see projects they are members of
    const userProjects = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        parentProjectId: projects.parentProjectId,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(
        projectMemberships,
        eq(projects.id, projectMemberships.projectId),
      )
      .where(eq(projectMemberships.userId, user.id));

    return userProjects.map((p: any) => ({
      ...p,
      parent_project_id: p.parentProjectId,
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
