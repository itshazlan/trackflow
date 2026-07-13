import { pgTable, uuid, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projects, projectRoleEnum } from './projects';

export const issueTrackers = pgTable('issue_trackers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
});

export const issueStatuses = pgTable('issue_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  restrictedToRole: projectRoleEnum('restricted_to_role'),
});

export const issueTemplates = pgTable('issue_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  trackerId: uuid('tracker_id').notNull().references(() => issueTrackers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  titlePattern: varchar('title_pattern', { length: 255 }),
  fields: jsonb('fields').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
