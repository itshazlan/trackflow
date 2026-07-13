import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const projectRoleEnum = pgEnum('project_role', ['manager', 'developer', 'reporter_qa']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentProjectId: uuid('parent_project_id').references((): any => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectMemberships = pgTable('project_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: projectRoleEnum('role').notNull(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
});
