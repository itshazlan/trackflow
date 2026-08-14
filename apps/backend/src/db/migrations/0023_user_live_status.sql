DO $$ BEGIN
  CREATE TYPE "public"."user_status" AS ENUM('active', 'idle', 'offline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_live_status" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" "user_status" DEFAULT 'offline' NOT NULL,
	"project_id" uuid,
	"issue_id" uuid,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "user_live_status" ADD CONSTRAINT "user_live_status_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_live_status" ADD CONSTRAINT "user_live_status_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_live_status" ADD CONSTRAINT "user_live_status_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
