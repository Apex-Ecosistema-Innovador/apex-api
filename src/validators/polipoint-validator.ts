import { z } from 'zod';
import { env } from '../config/env';
import { uuidSchema } from './common';

export const scanSchema = z.object({
  token: z.string().min(1),
});

export const createAwardSchema = z.object({
  studentId: uuidSchema,
  offeringId: uuidSchema,
  points: z.number().int().min(1).max(env.MAX_POINTS_PER_AWARD),
  reason: z.string().trim().max(255).optional(),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const revokeAwardSchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

export type CreateAwardInput = z.output<typeof createAwardSchema>;
