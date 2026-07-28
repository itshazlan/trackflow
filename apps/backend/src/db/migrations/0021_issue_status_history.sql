CREATE TABLE "issue_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"old_status_id" uuid,
	"new_status_id" uuid NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_old_status_id_issue_statuses_id_fk" FOREIGN KEY ("old_status_id") REFERENCES "public"."issue_statuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_new_status_id_issue_statuses_id_fk" FOREIGN KEY ("new_status_id") REFERENCES "public"."issue_statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
