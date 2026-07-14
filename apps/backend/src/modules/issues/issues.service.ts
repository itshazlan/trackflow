import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, or, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  issues,
  issueStatuses,
  issueTrackers,
} from '../../db/schema/issues';
import { projects, projectMemberships } from '../../db/schema/projects';
import { user } from '../../db/schema/auth';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import { RealtimeGateway } from '../../gateways/realtime.gateway';

@Injectable()
export class IssuesService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(
    projectId: string,
    createIssueDto: CreateIssueDto,
    userId: string,
  ) {
    const title = createIssueDto.title;
    const description = createIssueDto.description;

    if (!title || !title.trim()) {
      throw new BadRequestException('Issue title is required');
    }

    // 2. Set Default Status if statusId is not provided
    let targetStatusId = createIssueDto.statusId;
    if (!targetStatusId) {
      const projectStatuses = await this.db
        .select()
        .from(issueStatuses)
        .where(eq(issueStatuses.projectId, projectId))
        .orderBy(asc(issueStatuses.orderIndex));

      if (projectStatuses.length === 0) {
        throw new InternalServerErrorException(
          'Project has no workflow statuses seeded.',
        );
      }
      targetStatusId = projectStatuses[0].id;
    }

    // 3. Insert Issue atomically incrementing sequence
    const newIssue = await this.db.transaction(async (tx: any) => {
      const [updatedProject] = await tx
        .update(projects)
        .set({ issueSequence: sql`${projects.issueSequence} + 1` })
        .where(eq(projects.id, projectId))
        .returning({
          issueSequence: projects.issueSequence,
          key: projects.key,
        });

      if (!updatedProject) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }

      const [insertedIssue] = await tx
        .insert(issues)
        .values({
          projectId,
          trackerId: createIssueDto.trackerId,
          statusId: targetStatusId,
          title,
          description,
          assigneeId: createIssueDto.assigneeId || null,
          priority: createIssueDto.priority || 'medium',
          startDate: createIssueDto.startDate || null,
          dueDate: createIssueDto.dueDate || null,
          estimatedHours: createIssueDto.estimatedHours
            ? String(createIssueDto.estimatedHours)
            : null,
          createdBy: userId,
          number: updatedProject.issueSequence,
        })
        .returning();

      return {
        ...insertedIssue,
        projectKey: updatedProject.key,
        displayId: `${updatedProject.key}-${insertedIssue.number}`,
      };
    });

    return newIssue;
  }

  async findAllForProject(projectId: string) {
    // Return issues joined with statuses, trackers, and user profiles
    const list = await this.db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        description: issues.description,
        priority: issues.priority,
        startDate: issues.startDate,
        dueDate: issues.dueDate,
        estimatedHours: issues.estimatedHours,
        createdAt: issues.createdAt,
        tracker: {
          id: issueTrackers.id,
          name: issueTrackers.name,
        },
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          orderIndex: issueStatuses.orderIndex,
        },
        assignee: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        projectKey: projects.key,
      })
      .from(issues)
      .innerJoin(issueTrackers, eq(issues.trackerId, issueTrackers.id))
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .leftJoin(user, eq(issues.assigneeId, user.id))
      .where(eq(issues.projectId, projectId));

    return list.map((item: any) => ({
      ...item,
      displayId: `${item.projectKey}-${item.number}`,
    }));
  }

  async findAllForUser(userId: string) {
    const list = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        number: issues.number,
        title: issues.title,
        priority: issues.priority,
        dueDate: issues.dueDate,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
        },
        tracker: {
          id: issueTrackers.id,
          name: issueTrackers.name,
        },
        projectKey: projects.key,
      })
      .from(issues)
      .innerJoin(issueTrackers, eq(issues.trackerId, issueTrackers.id))
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(or(eq(issues.assigneeId, userId), eq(issues.createdBy, userId)));

    return list.map((item: any) => ({
      ...item,
      displayId: `${item.projectKey}-${item.number}`,
    }));
  }

  async findOne(id: string) {
    const [issue] = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        trackerId: issues.trackerId,
        statusId: issues.statusId,
        title: issues.title,
        description: issues.description,
        assigneeId: issues.assigneeId,
        priority: issues.priority,
        startDate: issues.startDate,
        dueDate: issues.dueDate,
        estimatedHours: issues.estimatedHours,
        createdBy: issues.createdBy,
        createdAt: issues.createdAt,
        number: issues.number,
        projectKey: projects.key,
      })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(eq(issues.id, id))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    return {
      ...issue,
      displayId: `${issue.projectKey}-${issue.number}`,
    };
  }

  async update(
    projectId: string,
    id: string,
    updateIssueDto: UpdateIssueDto,
    userId: string,
  ) {
    const [existingIssue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);

    if (!existingIssue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    // 1. Transition validation (if statusId is changing)
    if (
      updateIssueDto.statusId &&
      updateIssueDto.statusId !== existingIssue.statusId
    ) {
      const [targetStatus] = await this.db
        .select()
        .from(issueStatuses)
        .where(
          and(
            eq(issueStatuses.id, updateIssueDto.statusId),
            eq(issueStatuses.projectId, projectId),
          ),
        )
        .limit(1);

      if (!targetStatus) {
        throw new BadRequestException(
          'Target status does not exist in this project',
        );
      }

      // Check restrictedToRole constraint
      if (targetStatus.restrictedToRole) {
        const [membership] = await this.db
          .select()
          .from(projectMemberships)
          .where(
            and(
              eq(projectMemberships.projectId, projectId),
              eq(projectMemberships.userId, userId),
            ),
          )
          .limit(1);

        if (!membership || membership.role !== targetStatus.restrictedToRole) {
          throw new ForbiddenException(
            `Status "${targetStatus.name}" is restricted to role "${targetStatus.restrictedToRole}". Your project role: ${membership ? membership.role : 'none'}`,
          );
        }
      }
    }

    // Convert estimatedHours number to string for database compatibility if provided
    const updatePayload: any = { ...updateIssueDto };
    if (updateIssueDto.estimatedHours !== undefined) {
      updatePayload.estimatedHours =
        updateIssueDto.estimatedHours === null
          ? null
          : String(updateIssueDto.estimatedHours);
    }

    // 2. Perform Update
    const [updated] = await this.db
      .update(issues)
      .set(updatePayload)
      .where(and(eq(issues.id, id), eq(issues.projectId, projectId)))
      .returning();

    if (updated) {
      this.realtimeGateway.emitIssueUpdated(projectId, updated);
    }

    return updated;
  }

  async updateStatus(issueId: string, statusId: string, userId: string) {
    // 1. Get the issue to find its projectId
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const projectId = issue.projectId;

    // 2. Verify that the user is a member of this project
    const [membership] = await this.db
      .select()
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('Not a member of this project');
    }

    // 3. Get the target status and verify it belongs to this project
    const [targetStatus] = await this.db
      .select()
      .from(issueStatuses)
      .where(
        and(
          eq(issueStatuses.id, statusId),
          eq(issueStatuses.projectId, projectId),
        ),
      )
      .limit(1);

    if (!targetStatus) {
      throw new BadRequestException(
        'Target status does not exist in this project',
      );
    }

    // 4. Check restrictedToRole constraint
    if (
      targetStatus.restrictedToRole &&
      membership.role !== targetStatus.restrictedToRole
    ) {
      throw new ForbiddenException(
        `Status "${targetStatus.name}" is restricted to role "${targetStatus.restrictedToRole}". Your project role: ${membership.role}`,
      );
    }

    // 5. Perform Update
    const [updated] = await this.db
      .update(issues)
      .set({ statusId })
      .where(eq(issues.id, issueId))
      .returning();

    if (updated) {
      this.realtimeGateway.emitIssueUpdated(projectId, updated);
    }

    return updated;
  }

  async remove(projectId: string, id: string) {
    const [deleted] = await this.db
      .delete(issues)
      .where(and(eq(issues.id, id), eq(issues.projectId, projectId)))
      .returning();

    if (!deleted) {
      throw new NotFoundException(
        `Issue with ID ${id} not found in project ${projectId}`,
      );
    }

    return { message: 'Issue deleted successfully', deleted };
  }
}
