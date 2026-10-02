import { z } from 'zod';
import { paginationSchema, uuidSchema } from './common';

export const studentsQuerySchema = paginationSchema.extend({
  offeringId: uuidSchema.optional(),
  q: z.string().trim().max(100).optional(),
  minPoints: z.coerce.number().int().min(0).optional(),
  maxPoints: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['name', 'cedula', 'points']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type StudentsQuery = z.output<typeof studentsQuerySchema>;
