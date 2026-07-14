import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, or, isNull, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { issueTemplates } from '../../db/schema/issues';
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
    const [newTemplate] = await this.db
      .insert(issueTemplates)
      .values({
        name: createTemplateDto.name,
        trackerId: createTemplateDto.trackerId,
        projectId: createTemplateDto.projectId ?? null,
        titlePattern: createTemplateDto.titlePattern,
        fields: createTemplateDto.fields,
      })
      .returning();

    return newTemplate;
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto) {
    const [updated] = await this.db
      .update(issueTemplates)
      .set(updateTemplateDto)
      .where(eq(issueTemplates.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return updated;
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
