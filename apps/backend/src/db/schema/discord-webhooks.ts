import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  text,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { user } from './auth';

export const discordWebhooks = pgTable('discord_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'cascade',
  }),
  webhookUrl: varchar('webhook_url', { length: 2048 }).notNull(),
  events: jsonb('events').$type<string[]>().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
