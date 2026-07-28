import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow');

async function apply() {
  console.log('Applying issue_status_history table creation...');
  await sql`
    CREATE TABLE IF NOT EXISTS "issue_status_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
      "old_status_id" uuid REFERENCES "issue_statuses"("id") ON DELETE SET NULL,
      "new_status_id" uuid NOT NULL REFERENCES "issue_statuses"("id") ON DELETE CASCADE,
      "changed_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "changed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;
  console.log('Successfully created issue_status_history table!');

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log('Public tables in DB:', tables.map(t => t.table_name));

  await sql.end();
}

apply().catch(console.error);
