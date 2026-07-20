import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { documents } from '../../db/schema/documents';
import { user as userTable } from '../../db/schema/auth';
import { R2Service } from '../time-tracking/r2.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly r2Service: R2Service,
  ) {}

  async findAll(projectId: string) {
    return this.db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        fileName: documents.fileName,
        category: documents.category,
        description: documents.description,
        fileSizeBytes: documents.fileSizeBytes,
        mimeType: documents.mimeType,
        r2ObjectKey: documents.r2ObjectKey,
        uploadedBy: documents.uploadedBy,
        uploadedByName: userTable.name,
        uploadedAt: documents.uploadedAt,
        confirmedAt: documents.confirmedAt,
      })
      .from(documents)
      .innerJoin(userTable, eq(documents.uploadedBy, userTable.id))
      .where(eq(documents.projectId, projectId))
      .orderBy(documents.uploadedAt);
  }

  async create(projectId: string, dto: CreateDocumentDto, user: any) {
    const documentId = randomUUID();
    const objectKey = `project/${projectId}/documents/${dto.category}/${documentId}-${dto.fileName}`;

    // Get presigned URL for frontend upload
    const uploadUrl = await this.r2Service.getPresignedUploadUrl(objectKey, dto.mimeType);

    // Save document metadata (unconfirmed status)
    const [doc] = await this.db
      .insert(documents)
      .values({
        id: documentId,
        projectId,
        fileName: dto.fileName,
        category: dto.category,
        description: dto.description,
        fileSizeBytes: dto.fileSizeBytes,
        mimeType: dto.mimeType,
        r2ObjectKey: objectKey,
        uploadedBy: user.id,
      })
      .returning();

    return {
      documentId: doc.id,
      uploadUrl,
    };
  }

  async confirmUpload(projectId: string, docId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const [updated] = await this.db
      .update(documents)
      .set({ confirmedAt: new Date() })
      .where(eq(documents.id, docId))
      .returning();

    return updated;
  }

  async getDownloadUrl(projectId: string, docId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const downloadUrl = await this.r2Service.getPresignedDownloadUrl(doc.r2ObjectKey);
    return { downloadUrl };
  }

  async remove(projectId: string, docId: string, user: any, projectRole: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    // Role check: Admin or Manager can delete anything. Developer can only delete if they are the uploader.
    const isManager = projectRole === 'manager' || user.isAdmin;
    const isUploader = doc.uploadedBy === user.id;

    if (!isManager && !isUploader) {
      throw new ForbiddenException(
        'You do not have permission to delete this document (only uploader, manager, or admin)',
      );
    }

    // 1. Delete from storage (R2 or mock R2 local file)
    await this.r2Service.deleteObject(doc.r2ObjectKey);

    // 2. Delete metadata from DB
    await this.db.delete(documents).where(eq(documents.id, docId));

    return { success: true };
  }
}
