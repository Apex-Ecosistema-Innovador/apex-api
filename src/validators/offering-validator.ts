import { z } from 'zod';
import { uuidSchema } from './common';

export const createOfferingSchema = z.object({
  courseCode: z.string().trim().min(1).max(30),
  courseName: z.string().trim().min(2).max(150),
  term: z.string().trim().min(1).max(20),
});

export const updateOfferingSchema = z.object({
  courseName: z.string().trim().min(2).max(150).optional(),
  active: z.boolean().optional(),
});

export const publicOfferingsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const enrollmentSchema = z.object({
  offeringId: uuidSchema,
});

export type CreateOfferingInput = z.output<typeof createOfferingSchema>;
export type UpdateOfferingInput = z.output<typeof updateOfferingSchema>;
