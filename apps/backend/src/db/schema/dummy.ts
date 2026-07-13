import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const migrationsTest = pgTable('migrations_test', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
