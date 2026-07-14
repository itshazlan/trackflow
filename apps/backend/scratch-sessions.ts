import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { session, user } from './src/db/schema/auth';
import { eq } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  const activeSessions = await db
    .select({
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      userId: session.userId,
      userName: user.name,
      userEmail: user.email,
      isAdmin: user.isAdmin,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id));

  console.log('--- ACTIVE SESSIONS ---');
  console.log(activeSessions);

  await client.end();
}

main().catch(console.error);
