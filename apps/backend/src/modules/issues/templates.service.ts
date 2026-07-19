import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, or, isNull, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { issueTemplates, issueTrackers } from '../../db/schema/issues';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async findAllForProject(projectId: string) {
    return this.db
      .select()
      .from(issueTemplates)
      .where(
        or(
          eq(issueTemplates.projectId, projectId),
          isNull(issueTemplates.projectId),
        ),
      );
  }

  async findGlobal() {
    return this.db
      .select()
      .from(issueTemplates)
      .where(isNull(issueTemplates.projectId));
  }

  async findOne(id: string) {
    const [template] = await this.db
      .select()
      .from(issueTemplates)
      .where(eq(issueTemplates.id, id))
      .limit(1);

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async create(createTemplateDto: CreateTemplateDto) {
    let trackerId = createTemplateDto.trackerId;
    if (!trackerId) {
      // Find or create tracker by name
      const normalizedName = createTemplateDto.name.trim();
      const [existingTracker] = await this.db
        .select()
        .from(issueTrackers)
        .where(eq(issueTrackers.name, normalizedName))
        .limit(1);

      if (existingTracker) {
        trackerId = existingTracker.id;
      } else {
        const [newTracker] = await this.db
          .insert(issueTrackers)
          .values({ name: normalizedName })
          .returning();
        trackerId = newTracker.id;
      }
    }

    const [newTemplate] = await this.db
      .insert(issueTemplates)
      .values({
        name: createTemplateDto.name,
        trackerId: trackerId,
        projectId: createTemplateDto.projectId ?? null,
        titlePattern: createTemplateDto.titlePattern,
        descriptionPattern: createTemplateDto.descriptionPattern,
      })
      .returning();

    return newTemplate;
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto) {
    return this.db.transaction(async (tx: any) => {
      // Get the existing template to find the trackerId
      const [existing] = await tx
        .select()
        .from(issueTemplates)
        .where(eq(issueTemplates.id, id))
        .limit(1);
      
      if (!existing) {
        throw new NotFoundException(`Template with ID ${id} not found`);
      }

      const updateData: any = { ...updateTemplateDto };

      // If name is updated, rename the linked tracker as well (or link to existing)
      if (updateTemplateDto.name && updateTemplateDto.name.trim() !== existing.name) {
        const newName = updateTemplateDto.name.trim();
        // Check if there's another tracker with this name
        const [otherTracker] = await tx
          .select()
          .from(issueTrackers)
          .where(eq(issueTrackers.name, newName))
          .limit(1);

        if (otherTracker) {
          updateData.trackerId = otherTracker.id;
        } else {
          await tx
            .update(issueTrackers)
            .set({ name: newName })
            .where(eq(issueTrackers.id, existing.trackerId));
        }
      }

      const [updated] = await tx
        .update(issueTemplates)
        .set(updateData)
        .where(eq(issueTemplates.id, id))
        .returning();

      return updated;
    });
  }

  async remove(id: string) {
    const [deleted] = await this.db
      .delete(issueTemplates)
      .where(eq(issueTemplates.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return { message: 'Template deleted successfully', deleted };
  }
}
