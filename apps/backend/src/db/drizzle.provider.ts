import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

export const DrizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: () => {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://trackflow:trackflow@localhost:5432/trackflow';
    const client = postgres(connectionString);
    return drizzle(client, { schema });
  },
};
