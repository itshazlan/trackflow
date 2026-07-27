ALTER TABLE "issue_statuses" ADD COLUMN IF NOT EXISTS "is_final" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "issue_statuses" SET "is_final" = true WHERE LOWER("name") = 'done';
