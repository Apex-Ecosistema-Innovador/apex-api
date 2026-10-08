import { z } from 'zod';
import { MAX_EXPORT_ROWS } from '../constants/pagination';
import { paginationSchema, uuidSchema } from './common';

const studentsFilterShape = {
  offeringId: uuidSchema.optional(),
  q: z.string().trim().max(100).optional(),
  minPoints: z.coerce.number().int().min(0).max(1000000).optional(),
  maxPoints: z.coerce.number().int().min(0).max(1000000).optional(),
  sort: z.enum(['name', 'cedula', 'points']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
};

export const studentsQuerySchema = paginationSchema.extend(studentsFilterShape);

export const exportQuerySchema = z.object({
  ...studentsFilterShape,
  limit: z.coerce.number().int().min(1).max(MAX_EXPORT_ROWS).default(MAX_EXPORT_ROWS),
});
