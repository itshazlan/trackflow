import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { projects, projectMemberships } from './src/db/schema/projects';
import { user } from './src/db/schema/auth';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('--- USERS ---');
  const allUsers = await db.select().from(user);
  console.log(allUsers.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, isAdmin: u.isAdmin })));

  console.log('--- PROJECTS ---');
  const allProjects = await db.select().from(projects);
  console.log(allProjects);

  console.log('--- MEMBERSHIPS ---');
  const allMemberships = await db.select().from(projectMemberships);
  console.log(allMemberships);

  await client.end();
}

main().catch(console.error);
