CREATE TABLE "issue_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order_index" integer NOT NULL,
	"restricted_to_role" "project_role"
);
--> statement-breakpoint
CREATE TABLE "issue_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"tracker_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"title_pattern" varchar(255),
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	CONSTRAINT "issue_trackers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "issue_statuses" ADD CONSTRAINT "issue_statuses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_tracker_id_issue_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."issue_trackers"("id") ON DELETE cascade ON UPDATE no action;