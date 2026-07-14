ALTER TABLE "projects" ADD COLUMN "key" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "issue_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_key_unique" UNIQUE("key");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "unique_project_issue_number" UNIQUE("project_id","number");