CREATE TYPE "public"."notification_entity_type" AS ENUM('project', 'issue', 'timesheet', 'time_block');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('project_member_added', 'issue_assigned', 'issue_mentioned', 'timesheet_approved', 'timeblock_overridden');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"entity_type" "notification_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;