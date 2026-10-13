import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32),
  QR_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ALLOWED_EMAIL_DOMAIN: z.string().trim().toLowerCase().min(3).default('elpoli.edu.co'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  APEX_WEB_BASE_URL: z.string().url().default('http://localhost:3002'),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  EMAIL_VERIFICATION_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  PASSWORD_RESET_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('APEX Polipuntos <no-reply@localhost>'),
  MAX_POINTS_PER_AWARD: z.coerce.number().int().positive().default(1000),
  CURRENT_TERM: z
    .string()
    .regex(/^20\d{2}-[12]$/)
    .optional(),
  SCHEDULE_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  OFFLINE_AWARD_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = envSchema
  .refine((value) => value.NODE_ENV !== 'production' || Boolean(value.SMTP_HOST), {
    message: 'SMTP_HOST is required in production',
    path: ['SMTP_HOST'],
  })
  .parse(process.env);

export const env = {
  ...parsed,
  isProduction: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};
