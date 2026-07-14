ALTER TABLE "issue_templates" ALTER COLUMN "fields" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD COLUMN "description_pattern" text;