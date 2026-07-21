import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../db/schema';
import { bearer } from 'better-auth/plugins';

console.log(
  '[better-auth.config.ts] BETTER_AUTH_URL:',
  process.env.BETTER_AUTH_URL,
);
console.log(
  '[better-auth.config.ts] BETTER_AUTH_SECRET length:',
  process.env.BETTER_AUTH_SECRET?.length || 0,
);

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://trackflow:trackflow@localhost:5432/trackflow';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

const trustedOrigins = [
  'http://localhost:3001',
  'http://localhost:1420',
  'tauri://localhost',
  'https://tauri.localhost',
  'http://tauri.localhost',
];

if (process.env.BETTER_AUTH_URL) {
  try {
    const url = new URL(process.env.BETTER_AUTH_URL);
    trustedOrigins.push(url.origin);
  } catch (e) {
    console.error('Invalid BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  trustedOrigins,
  plugins: [bearer()],
  advanced: {
    trustedProxyHeaders: true, // Izinkan X-Forwarded-Host & X-Forwarded-Proto untuk set cookie di domain proxy
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: { type: 'string', required: true, unique: true },
      phoneNumber: { type: 'string', required: false },
      position: { type: 'string', required: false },
      department: { type: 'string', required: false },
      employeeId: { type: 'string', required: false, unique: true },
      joinDate: { type: 'date', required: false },
      employmentStatus: {
        type: 'string',
        required: false,
        defaultValue: 'active',
      },
      isAdmin: { type: 'boolean', required: false, defaultValue: false },
    },
  },
});

