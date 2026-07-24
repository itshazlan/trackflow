import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, or, asc, desc, sql, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE } from '../../db/drizzle.provider';
import {
  issues,
  issueStatuses,
  issueTrackers,
  issueAttachments,
  issueComments,
  commentAttachments,
} from '../../db/schema/issues';
import { projects, projectMemberships } from '../../db/schema/projects';
import { user } from '../../db/schema/auth';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CreateCommentAttachmentDto,
  ConfirmCommentAttachmentDto,
  CreateCommentImageDto,
  ConfirmCommentImageDto,
} from './dto/comment.dto';
import { RealtimeGateway } from '../../gateways/realtime.gateway';
import { R2Service } from '../time-tracking/r2.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class IssuesService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly r2Service: R2Service,
    private readonly notificationsService: NotificationsService,
    private readonly discordService: DiscordService,
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
          name: projects.name,
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
        projectName: updatedProject.name,
        displayId: `${updatedProject.key}-${insertedIssue.number}`,
      };
    });

    if (newIssue.assigneeId) {
      await this.notificationsService.createNotification({
        userId: newIssue.assigneeId,
        type: 'issue_assigned',
        title: 'Issue Ditugaskan ke Anda',
        body: `Anda telah ditugaskan ke issue "${newIssue.title}" (${newIssue.displayId}) di proyek "${newIssue.projectName || newIssue.projectKey}".`,
        entityType: 'issue',
        entityId: newIssue.id,
      });
    }

    // Fire-and-forget notification to Discord (non-blocking)
    this.discordService.notifyDiscordIssueCreated(newIssue, {
      id: projectId,
      key: newIssue.projectKey,
      name: newIssue.projectName,
    });

    return newIssue;
  }

  async findAllForProject(projectId: string) {
    // Return issues joined with statuses, trackers, and user profiles
    const list = await this.db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        trackerId: issues.trackerId,
        statusId: issues.statusId,
        assigneeId: issues.assigneeId,
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
          image: user.image,
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
    isAdmin?: boolean,
    projectRole?: string,
  ) {
    const [existingIssue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);

    if (!existingIssue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    // Check permission: Assignee, Creator, Manager, or Admin
    const isAssignee = existingIssue.assigneeId === userId;
    const isCreator = existingIssue.createdBy === userId;
    const isManager = projectRole === 'manager' || isAdmin;

    if (!isAssignee && !isCreator && !isManager) {
      throw new ForbiddenException(
        'Hanya Assignee, Pembuat issue, Manager proyek, atau Admin yang dapat memperbarui issue ini',
      );
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

    // Ensure protected/unmodifiable fields are stripped from the payload
    delete updatePayload.number;
    delete updatePayload.projectId;
    delete updatePayload.createdBy;
    delete updatePayload.id;

    // 2. Perform Update
    const [updated] = await this.db
      .update(issues)
      .set(updatePayload)
      .where(and(eq(issues.id, id), eq(issues.projectId, projectId)))
      .returning();

    if (updated) {
      this.realtimeGateway.emitIssueUpdated(projectId, updated);

      if (
        updateIssueDto.statusId &&
        updateIssueDto.statusId !== existingIssue.statusId
      ) {
        // Fire-and-forget notification to Discord
        this.sendDiscordStatusChangedNotification(
          existingIssue,
          existingIssue.statusId,
          updateIssueDto.statusId,
          userId,
        );
      }
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

    const oldStatusId = issue.statusId;

    // 5. Perform Update
    const [updated] = await this.db
      .update(issues)
      .set({ statusId })
      .where(eq(issues.id, issueId))
      .returning();

    if (updated) {
      this.realtimeGateway.emitIssueUpdated(projectId, updated);

      if (oldStatusId !== statusId) {
        this.sendDiscordStatusChangedNotification(
          issue,
          oldStatusId,
          statusId,
          userId,
        );
      }
    }

    return updated;
  }

  private async sendDiscordStatusChangedNotification(
    issue: any,
    oldStatusId: string,
    newStatusId: string,
    userId: string,
  ) {
    try {
      const [oldStatusObj] = await this.db
        .select({ name: issueStatuses.name })
        .from(issueStatuses)
        .where(eq(issueStatuses.id, oldStatusId))
        .limit(1);

      const [newStatusObj] = await this.db
        .select({ name: issueStatuses.name })
        .from(issueStatuses)
        .where(eq(issueStatuses.id, newStatusId))
        .limit(1);

      const [project] = await this.db
        .select({ key: projects.key })
        .from(projects)
        .where(eq(projects.id, issue.projectId))
        .limit(1);

      const [actor] = await this.db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (oldStatusObj && newStatusObj) {
        this.discordService.notifyDiscordStatusChanged(
          {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            projectId: issue.projectId,
            projectKey: project?.key || 'PRJ',
          },
          oldStatusObj.name,
          newStatusObj.name,
          { id: userId, name: actor?.name || 'Pengguna' },
        );
      }
    } catch (err: any) {
      // Fire-and-forget, ignore errors
    }
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

  async createAttachment(
    issueId: string,
    fileName: string,
    contentType: string,
    fileBuffer: Buffer,
    userId: string,
  ) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    // Check project membership (implicitly skip for global admins)
    const [currentUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser?.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, issue.projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Not a member of this project');
      }
    }

    const attachmentId = randomUUID();
    const objectKey = `project/${issue.projectId}/issues/${issueId}/attachments/${attachmentId}-${fileName}`;

    // Upload directly to R2 (server-side, avoiding CORS issues)
    await this.r2Service.uploadBuffer(objectKey, fileBuffer, contentType);

    // Save attachment in database
    const [attachment] = await this.db
      .insert(issueAttachments)
      .values({
        id: attachmentId,
        issueId,
        fileName,
        r2ObjectKey: objectKey,
        uploadedBy: userId,
      })
      .returning();

    return attachment;
  }

  async findAttachmentsForIssue(issueId: string, userId: string) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    // Check project membership (implicitly skip for global admins)
    const [currentUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser?.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, issue.projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Not a member of this project');
      }
    }

    return this.db
      .select()
      .from(issueAttachments)
      .where(eq(issueAttachments.issueId, issueId))
      .orderBy(asc(issueAttachments.uploadedAt));
  }

  async removeAttachment(
    issueId: string,
    attachmentId: string,
    userId: string,
    isAdmin: boolean,
  ) {
    const [attachment] = await this.db
      .select()
      .from(issueAttachments)
      .where(
        and(
          eq(issueAttachments.id, attachmentId),
          eq(issueAttachments.issueId, issueId),
        ),
      )
      .limit(1);

    if (!attachment) {
      throw new NotFoundException(
        `Attachment with ID ${attachmentId} not found on issue ${issueId}`,
      );
    }

    if (attachment.uploadedBy !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Only the uploader or an Admin can delete this attachment',
      );
    }

    // Delete from R2
    await this.r2Service.deleteObject(attachment.r2ObjectKey);

    // Delete from database
    await this.db
      .delete(issueAttachments)
      .where(eq(issueAttachments.id, attachmentId));

    return { success: true };
  }

  private async getIssueWithMemberAccess(issueId: string, userId: string) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const [currentUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser?.isAdmin) {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, issue.projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenException('Not a member of this project');
      }
    }

    return { issue, currentUser };
  }

  async findCommentsForIssue(issueId: string, userId: string) {
    await this.getIssueWithMemberAccess(issueId, userId);

    const allComments = await this.db
      .select({
        id: issueComments.id,
        issueId: issueComments.issueId,
        body: issueComments.body,
        parentCommentId: issueComments.parentCommentId,
        createdAt: issueComments.createdAt,
        updatedAt: issueComments.updatedAt,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(issueComments)
      .innerJoin(user, eq(issueComments.authorId, user.id))
      .where(eq(issueComments.issueId, issueId))
      .orderBy(desc(issueComments.createdAt));

    const commentIds = allComments.map((c: any) => c.id);
    let attachmentsMap: Record<string, any[]> = {};

    if (commentIds.length > 0) {
      const attachmentsList = await this.db
        .select()
        .from(commentAttachments)
        .where(inArray(commentAttachments.commentId, commentIds));

      for (const att of attachmentsList) {
        if (!attachmentsMap[att.commentId]) {
          attachmentsMap[att.commentId] = [];
        }
        attachmentsMap[att.commentId].push(att);
      }
    }

    return allComments.map((c: any) => ({
      ...c,
      commentAttachments: attachmentsMap[c.id] || [],
    }));
  }

  async createComment(
    issueId: string,
    createCommentDto: CreateCommentDto,
    userId: string,
  ) {
    const { issue, currentUser } = await this.getIssueWithMemberAccess(issueId, userId);

    // Validate parentCommentId guards if provided
    if (createCommentDto.parentCommentId) {
      const [parentComment] = await this.db
        .select()
        .from(issueComments)
        .where(eq(issueComments.id, createCommentDto.parentCommentId))
        .limit(1);

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment with ID ${createCommentDto.parentCommentId} not found`,
        );
      }

      // Guard 1: parentCommentId harus milik issue_id yang sama dengan komentar yang sedang dibuat
      if (parentComment.issueId !== issueId) {
        throw new BadRequestException(
          'Cannot reply to a comment from a different issue',
        );
      }

      // Guard 2: parentCommentId yang direferensikan wajib punya parentCommentId = NULL sendiri (mencegah reply-ke-reply)
      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException(
          'Cannot reply to a reply comment (nested replies are not allowed)',
        );
      }
    }

    const [comment] = await this.db
      .insert(issueComments)
      .values({
        issueId,
        authorId: userId,
        body: createCommentDto.body,
        parentCommentId: createCommentDto.parentCommentId || null,
      })
      .returning();

    const bodyPreview =
      createCommentDto.body.length > 100
        ? createCommentDto.body.substring(0, 100) + '...'
        : createCommentDto.body;

    this.realtimeGateway.emitCommentCreated(issue.projectId, {
      issueId,
      commentId: comment.id,
      authorId: userId,
      bodyPreview,
      parentCommentId: comment.parentCommentId || null,
      hasImages: false,
    });

    const mentionRegex = /@(\w+)/g;
    const matches: string[] = [];
    let match;
    while ((match = mentionRegex.exec(createCommentDto.body)) !== null) {
      matches.push(match[1]);
    }
    const uniqueUsernames = [...new Set(matches)];

    if (uniqueUsernames.length > 0) {
      const lowerUsernames = uniqueUsernames.map((u) => u.toLowerCase());
      const matchedUsers = await this.db
        .select()
        .from(user)
        .where(inArray(sql`lower(${user.username})`, lowerUsernames));

      for (const u of matchedUsers) {
        if (u.id !== userId) {
          await this.notificationsService.createNotification({
            userId: u.id,
            type: 'issue_mentioned',
            title: 'Anda disebut dalam komentar',
            body: `${currentUser.name} menyebut Anda di komentar issue "${issue.title}": "${bodyPreview}"`,
            entityType: 'issue',
            entityId: issue.id,
          });
        }
      }
    }

    const [commentWithAuthor] = await this.db
      .select({
        id: issueComments.id,
        issueId: issueComments.issueId,
        body: issueComments.body,
        parentCommentId: issueComments.parentCommentId,
        createdAt: issueComments.createdAt,
        updatedAt: issueComments.updatedAt,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(issueComments)
      .innerJoin(user, eq(issueComments.authorId, user.id))
      .where(eq(issueComments.id, comment.id))
      .limit(1);

    return {
      ...commentWithAuthor,
      commentAttachments: [],
    };
  }

  async createCommentAttachmentPresignedUrl(
    issueId: string,
    commentId: string,
    createAttachmentDto: CreateCommentAttachmentDto,
    userId: string,
  ) {
    const { issue } = await this.getIssueWithMemberAccess(issueId, userId);

    const [comment] = await this.db
      .select()
      .from(issueComments)
      .where(and(eq(issueComments.id, commentId), eq(issueComments.issueId, issueId)))
      .limit(1);

    if (!comment) {
      throw new NotFoundException(
        `Comment with ID ${commentId} not found on issue ${issueId}`,
      );
    }

    // Soft-limit 50MB check (52,428,800 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (createAttachmentDto.fileSizeBytes > MAX_FILE_SIZE) {
      throw new BadRequestException('Ukuran file tidak boleh melebihi 50MB');
    }

    const attachmentId = randomUUID();
    const objectKey = `project/${issue.projectId}/issues/${issueId}/comments/${commentId}/${attachmentId}-${createAttachmentDto.fileName}`;
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      objectKey,
      createAttachmentDto.mimeType || 'application/octet-stream',
    );

    return {
      attachmentId,
      imageId: attachmentId,
      commentId,
      uploadUrl,
      r2ObjectKey: objectKey,
      fileName: createAttachmentDto.fileName,
      mimeType: createAttachmentDto.mimeType,
      fileSizeBytes: createAttachmentDto.fileSizeBytes,
    };
  }

  async confirmCommentAttachmentUpload(
    issueId: string,
    commentId: string,
    attachmentId: string,
    confirmDto: ConfirmCommentAttachmentDto,
    userId: string,
  ) {
    const { issue } = await this.getIssueWithMemberAccess(issueId, userId);

    const [comment] = await this.db
      .select()
      .from(issueComments)
      .where(and(eq(issueComments.id, commentId), eq(issueComments.issueId, issueId)))
      .limit(1);

    if (!comment) {
      throw new NotFoundException(
        `Comment with ID ${commentId} not found on issue ${issueId}`,
      );
    }

    const fileName = confirmDto?.fileName || 'file';
    const mimeType = confirmDto?.mimeType || 'application/octet-stream';
    const fileSizeBytes = confirmDto?.fileSizeBytes || 0;
    const r2ObjectKey =
      confirmDto?.r2ObjectKey ||
      `project/${issue.projectId}/issues/${issueId}/comments/${commentId}/${attachmentId}-${fileName}`;

    const [attachment] = await this.db
      .insert(commentAttachments)
      .values({
        id: attachmentId,
        commentId,
        fileName,
        r2ObjectKey,
        mimeType,
        fileSizeBytes,
      })
      .returning();

    return attachment;
  }

  async getCommentAttachmentDownloadUrl(
    issueId: string,
    commentId: string,
    attachmentId: string,
    userId: string,
  ) {
    await this.getIssueWithMemberAccess(issueId, userId);

    const [attachment] = await this.db
      .select()
      .from(commentAttachments)
      .where(and(eq(commentAttachments.id, attachmentId), eq(commentAttachments.commentId, commentId)))
      .limit(1);

    if (!attachment) {
      throw new NotFoundException(
        `Attachment with ID ${attachmentId} not found on comment ${commentId}`,
      );
    }

    const downloadUrl = await this.r2Service.getPresignedDownloadUrl(attachment.r2ObjectKey);

    return {
      downloadUrl,
      fileName: attachment.fileName,
    };
  }

  async createCommentImagePresignedUrl(
    issueId: string,
    commentId: string,
    createImageDto: CreateCommentImageDto,
    userId: string,
  ) {
    return this.createCommentAttachmentPresignedUrl(issueId, commentId, createImageDto, userId);
  }

  async confirmCommentImageUpload(
    issueId: string,
    commentId: string,
    imageId: string,
    confirmDto: ConfirmCommentImageDto,
    userId: string,
  ) {
    return this.confirmCommentAttachmentUpload(issueId, commentId, imageId, confirmDto, userId);
  }

  async updateComment(
    issueId: string,
    commentId: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
  ) {
    const [comment] = await this.db
      .select()
      .from(issueComments)
      .where(
        and(
          eq(issueComments.id, commentId),
          eq(issueComments.issueId, issueId),
        ),
      )
      .limit(1);

    if (!comment) {
      throw new NotFoundException(
        `Comment with ID ${commentId} not found on issue ${issueId}`,
      );
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'Hanya penulis yang dapat mengubah komentar ini',
      );
    }

    await this.db
      .update(issueComments)
      .set({
        body: updateCommentDto.body,
        updatedAt: new Date(),
      })
      .where(eq(issueComments.id, commentId));

    const [commentWithAuthor] = await this.db
      .select({
        id: issueComments.id,
        issueId: issueComments.issueId,
        body: issueComments.body,
        createdAt: issueComments.createdAt,
        updatedAt: issueComments.updatedAt,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(issueComments)
      .innerJoin(user, eq(issueComments.authorId, user.id))
      .where(eq(issueComments.id, commentId))
      .limit(1);

    return commentWithAuthor;
  }

  async removeComment(
    issueId: string,
    commentId: string,
    userId: string,
    isAdmin: boolean,
  ) {
    const [comment] = await this.db
      .select()
      .from(issueComments)
      .where(
        and(
          eq(issueComments.id, commentId),
          eq(issueComments.issueId, issueId),
        ),
      )
      .limit(1);

    if (!comment) {
      throw new NotFoundException(
        `Comment with ID ${commentId} not found on issue ${issueId}`,
      );
    }

    if (comment.authorId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Hanya penulis atau Admin yang dapat menghapus komentar ini',
      );
    }

    await this.db.delete(issueComments).where(eq(issueComments.id, commentId));

    return { success: true };
  }
}
