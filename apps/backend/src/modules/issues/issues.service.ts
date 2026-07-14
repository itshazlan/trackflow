import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, or, asc } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  issues,
  issueStatuses,
  issueTemplates,
  issueTrackers,
} from '../../db/schema/issues';
import { projectMemberships } from '../../db/schema/projects';
import { user } from '../../db/schema/auth';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';

@Injectable()
export class IssuesService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async create(
    projectId: string,
    createIssueDto: CreateIssueDto,
    userId: string,
  ) {
    let title = createIssueDto.title;
    let description = createIssueDto.description;

    // 1. Template Resolution and Compiler (if templateId provided)
    if (createIssueDto.templateId) {
      const [template] = await this.db
        .select()
        .from(issueTemplates)
        .where(eq(issueTemplates.id, createIssueDto.templateId))
        .limit(1);

      if (!template) {
        throw new NotFoundException(
          `Issue template with ID ${createIssueDto.templateId} not found`,
        );
      }

      const fields = template.fields as any[];
      const fieldValues = createIssueDto.fieldValues || {};
      const titleValues = createIssueDto.titleValues || {};

      // Validate required template fields
      for (const field of fields) {
        if (field.required && !fieldValues[field.label]) {
          throw new BadRequestException(
            `Template field "${field.label}" is required. ${field.helperText || ''}`,
          );
        }
      }

      // Render Title
      let pattern = template.titlePattern || '';
      for (const [key, val] of Object.entries(titleValues)) {
        pattern = pattern.replace(new RegExp(`{${key}}`, 'g'), val);
      }
      title = pattern || `${template.name} - Created`;

      // Render Description
      let mdDesc = '';
      for (const field of fields) {
        const val = fieldValues[field.label] || '';
        mdDesc += `**${field.label}**:\n${val}\n\n`;
      }
      description = mdDesc.trim();
    }

    if (!title) {
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

    // 3. Insert Issue
    const [newIssue] = await this.db
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
      })
      .returning();

    return newIssue;
  }

  async findAllForProject(projectId: string) {
    // Return issues joined with statuses, trackers, and user profiles
    return this.db
      .select({
        id: issues.id,
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
      })
      .from(issues)
      .innerJoin(issueTrackers, eq(issues.trackerId, issueTrackers.id))
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(user, eq(issues.assigneeId, user.id))
      .where(eq(issues.projectId, projectId));
  }

  async findAllForUser(userId: string) {
    return this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
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
      })
      .from(issues)
      .innerJoin(issueTrackers, eq(issues.trackerId, issueTrackers.id))
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(or(eq(issues.assigneeId, userId), eq(issues.createdBy, userId)));
  }

  async findOne(id: string) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    return issue;
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
