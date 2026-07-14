import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  text,
  date,
  numeric,
  unique,
} from 'drizzle-orm/pg-core';
import { projects, projectRoleEnum } from './projects';
import { user } from './auth';

export const issueTrackers = pgTable('issue_trackers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
});

export const issueStatuses = pgTable('issue_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  restrictedToRole: projectRoleEnum('restricted_to_role'),
});

export const issueTemplates = pgTable('issue_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'cascade',
  }),
  trackerId: uuid('tracker_id')
    .notNull()
    .references(() => issueTrackers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  titlePattern: varchar('title_pattern', { length: 255 }),
  fields: jsonb('fields').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const issuePriorityEnum = pgEnum('issue_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  trackerId: uuid('tracker_id')
    .notNull()
    .references(() => issueTrackers.id, { onDelete: 'cascade' }),
  statusId: uuid('status_id')
    .notNull()
    .references(() => issueStatuses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  assigneeId: text('assignee_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  priority: issuePriorityEnum('priority').default('medium').notNull(),
  startDate: date('start_date', { mode: 'string' }),
  dueDate: date('due_date', { mode: 'string' }),
  estimatedHours: numeric('estimated_hours', { precision: 5, scale: 2 }),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  number: integer('number').notNull(),
}, (table) => [
  unique('unique_project_issue_number').on(table.projectId, table.number),
]);
