import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  bigint,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { user } from './auth';

export const documentCategoryEnum = pgEnum('document_category', [
  'project_doc',
  'supporting_file',
  'third_party',
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  category: documentCategoryEnum('category').default('project_doc').notNull(),
  description: text('description'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  r2ObjectKey: varchar('r2_object_key', { length: 512 }).notNull(),
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});
