import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { issueStatuses } from '../../db/schema/issues';
import { CreateStatusDto, UpdateStatusDto } from './dto/status.dto';

@Injectable()
export class StatusesService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async findAllForProject(projectId: string) {
    return this.db
      .select()
      .from(issueStatuses)
      .where(eq(issueStatuses.projectId, projectId))
      .orderBy(asc(issueStatuses.orderIndex));
  }

  async findOne(id: string) {
    const [status] = await this.db
      .select()
      .from(issueStatuses)
      .where(eq(issueStatuses.id, id))
      .limit(1);

    if (!status) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }

    return status;
  }

  async create(projectId: string, createStatusDto: CreateStatusDto) {
    const [newStatus] = await this.db
      .insert(issueStatuses)
      .values({
        projectId,
        name: createStatusDto.name,
        orderIndex: createStatusDto.orderIndex,
        restrictedToRole: createStatusDto.restrictedToRole,
      })
      .returning();

    return newStatus;
  }

  async update(
    projectId: string,
    id: string,
    updateStatusDto: UpdateStatusDto,
  ) {
    const [updated] = await this.db
      .update(issueStatuses)
      .set(updateStatusDto)
      .where(
        and(eq(issueStatuses.id, id), eq(issueStatuses.projectId, projectId)),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException(
        `Status with ID ${id} not found in project ${projectId}`,
      );
    }

    return updated;
  }

  async remove(projectId: string, id: string) {
    const [deleted] = await this.db
      .delete(issueStatuses)
      .where(
        and(eq(issueStatuses.id, id), eq(issueStatuses.projectId, projectId)),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException(
        `Status with ID ${id} not found in project ${projectId}`,
      );
    }

    return { message: 'Status deleted successfully', deleted };
  }

  async reorder(projectId: string, statusIds: string[]) {
    return this.db.transaction(async (tx: any) => {
      const updatedStatuses = [];

      for (let i = 0; i < statusIds.length; i++) {
        const [updated] = await tx
          .update(issueStatuses)
          .set({ orderIndex: i })
          .where(
            and(
              eq(issueStatuses.id, statusIds[i]),
              eq(issueStatuses.projectId, projectId),
            ),
          )
          .returning();

        if (updated) {
          updatedStatuses.push(updated);
        }
      }

      return updatedStatuses;
    });
  }
}
