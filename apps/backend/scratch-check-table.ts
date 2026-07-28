import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow');

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log('Public tables in DB:', tables.map(t => t.table_name));

  const migrations = await sql`
    SELECT * FROM __drizzle_migrations;
  `;
  console.log('Applied migrations:', migrations);

  await sql.end();
}

check().catch(console.error);
