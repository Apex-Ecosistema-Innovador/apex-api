import 'dotenv/config';
import { z } from 'zod';
import type { PoolConfig } from 'pg';

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
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
});

export function buildConnection(source: NodeJS.ProcessEnv = process.env): PoolConfig {
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

export function buildPoolConfig(source: NodeJS.ProcessEnv = process.env): PoolConfig {
  const parsed = connectionSchema.parse(source);
  return {
    ...buildConnection(source),
    max: parsed.DB_POOL_MAX,
    idleTimeoutMillis: parsed.DB_POOL_IDLE_TIMEOUT_MS,
  };
}
