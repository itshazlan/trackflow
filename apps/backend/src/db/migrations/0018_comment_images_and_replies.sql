ALTER TABLE "issue_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_parent_comment_id_issue_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"r2_object_key" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_issue_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
