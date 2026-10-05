import { z } from 'zod';
import { env } from '../config/env';
import AwardSource from '../types/enums/award-source';
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
  source: z.enum(AwardSource).default(AwardSource.Qr),
});

export const offlineAwardSchema = z
  .object({
    qrToken: z.string().min(1).optional(),
    studentId: uuidSchema.optional(),
    offeringId: uuidSchema,
    points: z.number().int().min(1).max(env.MAX_POINTS_PER_AWARD),
    reason: z.string().trim().max(255).optional(),
    idempotencyKey: z.string().trim().min(8).max(100),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .refine((item) => Boolean(item.qrToken || item.studentId), 'Indica el QR o el estudiante');

export const batchAwardsSchema = z.object({
  items: z.array(z.unknown()).min(1).max(100),
});

export const revokeAwardSchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

export type OfflineAwardInput = z.output<typeof offlineAwardSchema>;
export type CreateAwardInput = z.output<typeof createAwardSchema>;
