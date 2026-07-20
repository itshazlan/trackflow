import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  bigint,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { user } from './auth';

export const documentCategoryEnum = pgEnum('document_category', [
  'project_doc',
  'supporting_file',
  'third_party',
]);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: documentCategoryEnum('category').default('project_doc').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('documents_project_id_created_at_idx').on(table.projectId, table.createdAt),
  ]
);

export const documentFiles = pgTable(
  'document_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    r2ObjectKey: varchar('r2_object_key', { length: 512 }).notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [
    index('document_files_document_id_uploaded_at_idx').on(table.documentId, table.uploadedAt),
  ]
);
