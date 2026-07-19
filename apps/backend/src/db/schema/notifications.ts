import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const notificationTypeEnum = pgEnum('notification_type', [
  'project_member_added',
  'issue_assigned',
  'issue_mentioned',
  'timesheet_approved',
  'timeblock_overridden',
]);

export const notificationEntityTypeEnum = pgEnum('notification_entity_type', [
  'project',
  'issue',
  'timesheet',
  'time_block',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  entityType: notificationEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
