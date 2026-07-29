import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dhKey: varchar('p256dh_key', { length: 255 }).notNull(),
  authKey: varchar('auth_key', { length: 255 }).notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
