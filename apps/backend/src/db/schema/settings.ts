import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const appSettings = pgTable('app_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }),
  screenshotRetentionDays: integer('screenshot_retention_days').default(365).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
