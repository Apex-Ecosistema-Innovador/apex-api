import { z } from 'zod';
import { uuidSchema } from './common';

export const courseCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Ingresa el código de la asignatura')
  .max(30)
  .regex(/^[A-Z0-9]+$/, 'El código solo puede tener letras mayúsculas y números');

export const termSchema = z
  .string()
  .trim()
  .regex(/^20\d{2}-[12]$/, 'El periodo debe tener el formato año-semestre, por ejemplo 2026-2');

export const createOfferingSchema = z.object({
  courseCode: courseCodeSchema,
  courseName: z.string().trim().min(2).max(150),
  term: termSchema,
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
