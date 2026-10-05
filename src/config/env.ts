import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  QR_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  MAX_POINTS_PER_AWARD: z.coerce.number().int().positive().default(1000),
  OFFLINE_AWARD_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  isProduction: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};
