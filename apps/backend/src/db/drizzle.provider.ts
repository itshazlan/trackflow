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
      await client`ALTER TABLE "issue_statuses" ADD COLUMN IF NOT EXISTS "is_final" boolean DEFAULT false NOT NULL;`;
      await client`UPDATE "issue_statuses" SET "is_final" = true WHERE LOWER("name") = 'done';`;
    } catch (err) {
      console.error('[DrizzleProvider] Auto migration error:', err);
    }

    return db;
  },
};
