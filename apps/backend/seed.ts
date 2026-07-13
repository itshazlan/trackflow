import 'dotenv/config';
import { auth } from './src/modules/auth/better-auth.config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { appSettings } from './src/db/schema/settings';

async function seed() {
  console.log('Seeding database...');

  // 1. Seed 1 app_settings row if not exists
  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  const existingSettings = await db.select().from(appSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(appSettings).values({
      companyName: 'TrackFlow Inc',
      screenshotRetentionDays: 365,
    });
    console.log('✅ Seeded 1 app_settings row.');
  } else {
    console.log('ℹ️ app_settings already exists, skipping.');
  }

  // 2. Seed 1 admin user using Better Auth API
  try {
    const adminUser = await auth.api.signUpEmail({
      body: {
        email: 'admin@trackflow.com',
        password: 'AdminPassword123!',
        name: 'TrackFlow Admin',
        username: 'admin',
        phoneNumber: '081234567890',
        position: 'Administrator',
        department: 'Operations',
        employeeId: 'EMP-ADMIN-01',
        employmentStatus: 'active',
        isAdmin: true,
      },
    });
    console.log('✅ Seeded admin user:', adminUser.user.email);
  } catch (err: any) {
    // Better Auth might throw a redirect or object depending on standard handler.
    // If it's a validation error or user already exists, let's catch it.
    if (err.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' || (err.message && err.message.includes('already exists'))) {
      console.log('ℹ️ Admin user already exists, skipping.');
    } else {
      console.error('❌ Failed to seed admin user:', err);
    }
  }

  await client.end();
  console.log('Seeding completed!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed with error:', err);
  process.exit(1);
});
