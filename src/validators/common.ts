import { z } from 'zod';
import { normalizeCedula } from '../lib/normalize';

export const cedulaSchema = z
  .string()
  .trim()
  .transform(normalizeCedula)
  .refine((value) => value.length >= 5 && value.length <= 12, 'La cédula debe tener entre 5 y 12 dígitos');

export const fullNameSchema = z.string().trim().min(3, 'Ingresa tu nombre').max(150);

export const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(100);

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
