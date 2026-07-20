import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { sql, eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import { documents, documentFiles } from '../../db/schema/documents';
import { user as userTable } from '../../db/schema/auth';
import { R2Service } from '../time-tracking/r2.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { RequestFileUploadDto } from './dto/request-file-upload.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly r2Service: R2Service,
  ) {}

  async findAll(projectId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Get total count of containers in project
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.projectId, projectId));
    const total = totalResult?.count || 0;

    // Select document containers with count of confirmed files
    const rows = await this.db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        title: documents.title,
        description: documents.description,
        category: documents.category,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        creatorId: userTable.id,
        creatorName: userTable.name,
        creatorUsername: userTable.username,
        fileCount: sql<number>`cast(count(${documentFiles.id}) as integer)`,
      })
      .from(documents)
      .innerJoin(userTable, eq(documents.createdBy, userTable.id))
      .leftJoin(
        documentFiles,
        and(
          eq(documents.id, documentFiles.documentId),
          sql`${documentFiles.confirmedAt} IS NOT NULL`,
        ),
      )
      .where(eq(documents.projectId, projectId))
      .groupBy(
        documents.id,
        documents.projectId,
        documents.title,
        documents.description,
        documents.category,
        documents.createdAt,
        documents.updatedAt,
        userTable.id,
        userTable.name,
        userTable.username,
      )
      .orderBy(sql`${documents.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      fileCount: r.fileCount,
      createdBy: {
        id: r.creatorId,
        name: r.creatorName,
        username: r.creatorUsername,
      },
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      data,
      pagination: { page, limit, total },
    };
  }

  async create(projectId: string, dto: CreateContainerDto, user: any) {
    const documentId = randomUUID();
    const [doc] = await this.db
      .insert(documents)
      .values({
        id: documentId,
        projectId,
        title: dto.title,
        category: dto.category,
        description: dto.description,
        createdBy: user.id,
      })
      .returning();

    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      fileCount: 0,
      createdBy: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
      createdAt: doc.createdAt.toISOString(),
    };
  }

  async findOne(projectId: string, documentId: string) {
    // 1. Get container details
    const [doc] = await this.db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        title: documents.title,
        description: documents.description,
        category: documents.category,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        creatorId: userTable.id,
        creatorName: userTable.name,
        creatorUsername: userTable.username,
      })
      .from(documents)
      .innerJoin(userTable, eq(documents.createdBy, userTable.id))
      .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document container not found');
    }

    // 2. Get confirmed files inside container
    const fileRows = await this.db
      .select({
        id: documentFiles.id,
        documentId: documentFiles.documentId,
        fileName: documentFiles.fileName,
        fileSizeBytes: documentFiles.fileSizeBytes,
        mimeType: documentFiles.mimeType,
        uploadedBy: userTable.id,
        uploadedByName: userTable.name,
        uploadedByUsername: userTable.username,
        uploadedAt: documentFiles.uploadedAt,
      })
      .from(documentFiles)
      .innerJoin(userTable, eq(documentFiles.uploadedBy, userTable.id))
      .where(
        and(
          eq(documentFiles.documentId, documentId),
          sql`${documentFiles.confirmedAt} IS NOT NULL`,
        ),
      )
      .orderBy(documentFiles.uploadedAt);

    const files = fileRows.map((f: any) => {
      const mimeLower = f.mimeType.toLowerCase();
      const ext = f.fileName.split('.').pop()?.toLowerCase() || '';
      const isImage =
        mimeLower.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);

      return {
        id: f.id,
        fileName: f.fileName,
        fileSizeBytes: Number(f.fileSizeBytes),
        mimeType: f.mimeType,
        isImage,
        uploadedBy: {
          id: f.uploadedBy,
          name: f.uploadedByName,
          username: f.uploadedByUsername,
        },
        uploadedAt: f.uploadedAt.toISOString(),
      };
    });

    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      createdBy: {
        id: doc.creatorId,
        name: doc.creatorName,
        username: doc.creatorUsername,
      },
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      files,
    };
  }

  async update(
    projectId: string,
    documentId: string,
    dto: UpdateContainerDto,
    user: any,
    projectRole: string,
  ) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document container not found');
    }

    const isManager = projectRole === 'manager' || user.isAdmin;
    const isCreator = doc.createdBy === user.id;
    if (!isManager && !isCreator) {
      throw new ForbiddenException(
        'You do not have permission to edit this document container (only creator, manager, or admin)',
      );
    }

    const updateValues: any = { updatedAt: new Date() };
    if (dto.title !== undefined) updateValues.title = dto.title;
    if (dto.category !== undefined) updateValues.category = dto.category;
    if (dto.description !== undefined) updateValues.description = dto.description;

    const [updated] = await this.db
      .update(documents)
      .set(updateValues)
      .where(eq(documents.id, documentId))
      .returning();

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async remove(projectId: string, documentId: string, user: any, projectRole: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document container not found');
    }

    const isManager = projectRole === 'manager' || user.isAdmin;
    const isCreator = doc.createdBy === user.id;
    if (!isManager && !isCreator) {
      throw new ForbiddenException(
        'You do not have permission to delete this document container (only creator, manager, or admin)',
      );
    }

    // 1. Get all associated files (both confirmed and unconfirmed for thorough cleanup)
    const files = await this.db
      .select()
      .from(documentFiles)
      .where(eq(documentFiles.documentId, documentId));

    // 2. Delete all S3/R2 objects
    await Promise.all(
      files.map(async (file: any) => {
        try {
          await this.r2Service.deleteObject(file.r2ObjectKey);
        } catch (err) {
          console.error(
            `[DocumentsService Cascade Delete R2 Error] key: ${file.r2ObjectKey}`,
            err,
          );
        }
      }),
    );

    // 3. Delete container from DB (cascade option will clean up documentFiles records)
    await this.db.delete(documents).where(eq(documents.id, documentId));

    return {
      success: true,
      deletedFileCount: files.length,
    };
  }

  async requestFileUpload(
    projectId: string,
    documentId: string,
    dto: RequestFileUploadDto,
    user: any,
  ) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
      .limit(1);

    if (!doc) {
      throw new NotFoundException('Document container not found');
    }

    const fileId = randomUUID();
    const objectKey = `project/${projectId}/documents/${documentId}/${fileId}-${dto.fileName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(objectKey, dto.mimeType);

    // Save initial file metadata in database (unconfirmed status)
    await this.db.insert(documentFiles).values({
      id: fileId,
      documentId,
      fileName: dto.fileName,
      r2ObjectKey: objectKey,
      fileSizeBytes: dto.fileSizeBytes,
      mimeType: dto.mimeType,
      uploadedBy: user.id,
    });

    return {
      fileId,
      uploadUrl,
      expiresIn: 900,
    };
  }

  async confirmFileUpload(
    projectId: string,
    documentId: string,
    fileId: string,
    user: any,
  ) {
    // Check if the file exists and is belonging to the document container
    const [file] = await this.db
      .select()
      .from(documentFiles)
      .where(and(eq(documentFiles.id, fileId), eq(documentFiles.documentId, documentId)))
      .limit(1);

    if (!file) {
      throw new NotFoundException('File upload ticket not found');
    }

    const [updated] = await this.db
      .update(documentFiles)
      .set({ confirmedAt: new Date() })
      .where(eq(documentFiles.id, fileId))
      .returning();

    return {
      id: updated.id,
      fileName: updated.fileName,
      fileSizeBytes: Number(updated.fileSizeBytes),
      mimeType: updated.mimeType,
      uploadedBy: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
      uploadedAt: updated.uploadedAt.toISOString(),
    };
  }

  async getFileDownloadUrl(projectId: string, documentId: string, fileId: string) {
    const [file] = await this.db
      .select()
      .from(documentFiles)
      .where(and(eq(documentFiles.id, fileId), eq(documentFiles.documentId, documentId)))
      .limit(1);

    if (!file || !file.confirmedAt) {
      throw new NotFoundException('File not found or not confirmed yet');
    }

    const downloadUrl = await this.r2Service.getPresignedDownloadUrl(file.r2ObjectKey);
    return {
      downloadUrl,
      expiresIn: 900,
    };
  }

  async removeFile(
    projectId: string,
    documentId: string,
    fileId: string,
    user: any,
    projectRole: string,
  ) {
    const [file] = await this.db
      .select()
      .from(documentFiles)
      .where(and(eq(documentFiles.id, fileId), eq(documentFiles.documentId, documentId)))
      .limit(1);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const isManager = projectRole === 'manager' || user.isAdmin;
    const isUploader = file.uploadedBy === user.id;
    if (!isManager && !isUploader) {
      throw new ForbiddenException(
        'You do not have permission to delete this file (only uploader, manager, or admin)',
      );
    }

    // 1. Delete object from storage
    await this.r2Service.deleteObject(file.r2ObjectKey);

    // 2. Delete database record
    await this.db.delete(documentFiles).where(eq(documentFiles.id, fileId));

    return { success: true };
  }
}
