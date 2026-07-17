import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { projects } from './projects';
import { issues } from './issues';

export const deletionTypeEnum = pgEnum('deletion_type', [
  'self',
  'admin_override',
]);
export const auditActionEnum = pgEnum('audit_action', [
  'self_delete',
  'admin_override_delete',
  'admin_override_mark_unpaid',
]);
export const activityLevelEnum = pgEnum('activity_level', [
  'none',
  'low',
  'medium',
  'high',
]);

export const timeBlocks = pgTable('time_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id').references(() => issues.id, {
    onDelete: 'set null',
  }),
  note: text('note'),
  blockStart: timestamp('block_start', { withTimezone: true }).notNull(),
  blockEnd: timestamp('block_end', { withTimezone: true }).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by').references(() => user.id, {
    onDelete: 'set null',
  }),
  deletionType: deletionTypeEnum('deletion_type'),
  deletionReason: text('deletion_reason'),
  isPaid: boolean('is_paid').default(true).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  purgeAfter: timestamp('purge_after', { withTimezone: true }).notNull(),
});

export const timeBlockAuditLogs = pgTable('time_block_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timeBlockId: uuid('time_block_id')
    .notNull()
    .references(() => timeBlocks.id, { onDelete: 'cascade' }),
  action: auditActionEnum('action').notNull(),
  actorId: text('actor_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  targetUserId: text('target_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  timeBlockId: uuid('time_block_id')
    .notNull()
    .references(() => timeBlocks.id, { onDelete: 'cascade' }),
  r2ObjectKey: varchar('r2_object_key', { length: 512 }).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timeBlockId: uuid('time_block_id')
    .notNull()
    .references(() => timeBlocks.id, { onDelete: 'cascade' }),
  keyboardCount: integer('keyboard_count').notNull(),
  mouseCount: integer('mouse_count').notNull(),
  activityLevel: activityLevelEnum('activity_level').notNull(),
  activeAppName: varchar('active_app_name', { length: 255 }).notNull(),
  activeWindowTitle: varchar('active_window_title', { length: 512 }).notNull(),
});
