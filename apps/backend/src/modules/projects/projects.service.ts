import { Injectable, Inject, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { projects, projectMemberships } from '../../db/schema/projects';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    try {
      return await this.db.transaction(async (tx: any) => {
        // 1. Insert project
        const [newProject] = await tx
          .insert(projects)
          .values({
            name: createProjectDto.name,
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

        return newProject;
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to create project');
    }
  }

  async findAll(user: { id: string; isAdmin: boolean }) {
    if (user.isAdmin) {
      // Admins see all projects
      return this.db.select().from(projects);
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
      .innerJoin(projectMemberships, eq(projects.id, projectMemberships.projectId))
      .where(eq(projectMemberships.userId, user.id));

    return userProjects;
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

  async remove(id: string) {
    const [deleted] = await this.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return { message: 'Project deleted successfully', deleted };
  }
}
