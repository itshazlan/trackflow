import 'dotenv/config';
import { auth } from './src/modules/auth/better-auth.config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { appSettings } from './src/db/schema/settings';
import { issueTrackers, issueTemplates } from './src/db/schema/issues';
import { eq, and, isNull } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  const connectionString = process.env.DATABASE_URL || 'postgres://trackflow:trackflow@localhost:5432/trackflow';
  const client = postgres(connectionString);
  const db = drizzle(client);

  // 1. Seed 1 app_settings row if not exists
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
    if (err.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' || (err.message && err.message.includes('already exists'))) {
      console.log('ℹ️ Admin user already exists, skipping.');
    } else {
      console.error('❌ Failed to seed admin user:', err);
    }
  }

  // 3. Seed Default Issue Trackers (Bug, Feature, Support)
  const trackersToSeed = ['Bug', 'Feature', 'Support'];
  const seededTrackers: Record<string, string> = {};

  for (const trackerName of trackersToSeed) {
    const [existing] = await db
      .select()
      .from(issueTrackers)
      .where(eq(issueTrackers.name, trackerName))
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(issueTrackers)
        .values({ name: trackerName })
        .returning();
      seededTrackers[trackerName] = inserted.id;
      console.log(`✅ Seeded tracker: ${trackerName}`);
    } else {
      seededTrackers[trackerName] = existing.id;
      console.log(`ℹ️ Tracker already exists: ${trackerName}`);
    }
  }

  // 4. Seed Default Global Bug Template
  const bugTrackerId = seededTrackers['Bug'];
  if (bugTrackerId) {
    const [existingTemplate] = await db
      .select()
      .from(issueTemplates)
      .where(
        and(
          eq(issueTemplates.name, 'Bug Report'),
          isNull(issueTemplates.projectId)
        )
      )
      .limit(1);

    if (!existingTemplate) {
      const bugFields = [
        { label: 'Role User', required: false },
        { label: 'Current Condition', required: false },
        { label: 'Expected Result', required: false },
        { label: 'Link Halaman', required: false },
        { label: 'Step to Reproduce', required: false },
        { label: 'Evidence', required: false },
        { label: 'Environment', required: true, helperText: 'Wajib diisi bug terjadi di mana' }
      ];

      await db.insert(issueTemplates).values({
        name: 'Bug Report',
        trackerId: bugTrackerId,
        projectId: null, // global
        titlePattern: '[BUG] {feature} - {bugName}',
        fields: bugFields,
      });
      console.log('✅ Seeded default global Bug Report template.');
    } else {
      console.log('ℹ️ Default global Bug Report template already exists, skipping.');
    }
  }

  await client.end();
  console.log('Seeding completed!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed with error:', err);
  process.exit(1);
});
