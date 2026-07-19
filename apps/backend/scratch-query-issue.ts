import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { issues } from './src/db/schema/issues';
import { eq } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log(`Checking all issues...`);

  const allIssues = await db.select().from(issues);
  console.log('Result:', allIssues.map(i => ({ id: i.id, title: i.title, projectId: i.projectId })));

  await client.end();
}

main().catch(console.error);
