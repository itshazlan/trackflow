import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

export const DrizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: async () => {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://trackflow:trackflow@localhost:5432/trackflow';
    const client = postgres(connectionString);
    const db = drizzle(client, { schema });

    try {
      await client`ALTER TABLE "issue_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid;`;
      await client`ALTER TABLE "issue_statuses" ADD COLUMN IF NOT EXISTS "is_final" boolean DEFAULT false NOT NULL;`;
      await client`UPDATE "issue_statuses" SET "is_final" = true WHERE LOWER("name") = 'done';`;
      await client`
        CREATE TABLE IF NOT EXISTS "recently_viewed_issues" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
          "issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE cascade,
          "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
          CONSTRAINT "recently_viewed_user_issue_idx" UNIQUE("user_id", "issue_id")
        );
      `;
      await client`DO $$ BEGIN CREATE TYPE "public"."user_status" AS ENUM('active', 'idle', 'offline'); EXCEPTION WHEN duplicate_object THEN null; END $$;`;
      await client`
        CREATE TABLE IF NOT EXISTS "user_live_status" (
          "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
          "status" "user_status" DEFAULT 'offline' NOT NULL,
          "project_id" uuid REFERENCES "projects"("id") ON DELETE set null,
          "issue_id" uuid REFERENCES "issues"("id") ON DELETE set null,
          "last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `;
    } catch (err) {
      console.error('[DrizzleProvider] Auto migration error:', err);
    }

    return db;
  },
};
