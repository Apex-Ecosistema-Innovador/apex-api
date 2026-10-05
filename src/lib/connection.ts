import 'dotenv/config';
import { z } from 'zod';
import type { Knex } from 'knex';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const connectionSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DB_SSL: flag,
  DB_SSL_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DB_SSL_CA: z.string().optional(),
});

export function buildConnection(source: NodeJS.ProcessEnv = process.env): Knex.PgConnectionConfig {
  const parsed = connectionSchema.parse(source);

  if (!parsed.DB_SSL) return { connectionString: parsed.DATABASE_URL };

  return {
    connectionString: parsed.DATABASE_URL,
    ssl: {
      rejectUnauthorized: parsed.DB_SSL_REJECT_UNAUTHORIZED,
      ...(parsed.DB_SSL_CA ? { ca: parsed.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
    },
  };
}
