import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { notifications } from './src/db/schema/notifications';
import { desc } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('--- COMMENTS ---');
  const { issueComments } = require('./src/db/schema/issues');
  const allComments = await db.select().from(issueComments);
  console.log(allComments);

  await client.end();
}

main().catch(console.error);
