import { 
  pgTable, uuid, text, integer, date, timestamp, pgEnum, varchar 
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { projects } from './projects';
import { issues } from './issues';

// --- Enums ---
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);
export const timesheetStatusEnum = pgEnum('timesheet_status', ['draft', 'submitted', 'approved', 'rejected']);
export const timesheetDecisionEnum = pgEnum('timesheet_decision', ['approved', 'rejected']);

// --- Manual Time Entries ---
export const manualTimeEntries = pgTable('manual_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  durationMinutes: integer('duration_minutes').notNull(),
  description: text('description').notNull(),
  entryDate: date('entry_date', { mode: 'string' }).notNull(),
  approvalStatus: approvalStatusEnum('approval_status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Timesheets ---
export const timesheets = pgTable('timesheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  totalMinutes: integer('total_minutes').notNull().default(0),
  status: timesheetStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Timesheet Approvals ---
export const timesheetApprovals = pgTable('timesheet_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  timesheetId: uuid('timesheet_id').notNull().references(() => timesheets.id, { onDelete: 'cascade' }),
  reviewedBy: text('reviewed_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  decision: timesheetDecisionEnum('decision').notNull(),
  note: text('note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
});
