CREATE TABLE IF NOT EXISTS "issue_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"imported_by" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"sheet_name" varchar(255) NOT NULL,
	"total_rows" integer NOT NULL,
	"success_rows" integer NOT NULL,
	"error_rows" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "issue_imports" ADD CONSTRAINT "issue_imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "issue_imports" ADD CONSTRAINT "issue_imports_imported_by_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
