import { z } from 'zod';
import { env } from '../config/env';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';
import { normalizeCedula } from '../lib/normalize';

export const cedulaSchema = z
  .string()
  .trim()
  .transform(normalizeCedula)
  .refine((value) => value.length >= 5 && value.length <= 12, 'La cédula debe tener entre 5 y 12 dígitos');

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'Ingresa tu nombre')
  .max(150)
  .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'El nombre solo puede tener letras y espacios')
  .transform((value) => value.replace(/\s+/g, ' '));

export const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(100);

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const institutionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Ingresa un correo válido'))
  .refine(
    (value) => value.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`),
    `Usa tu correo institucional (@${env.ALLOWED_EMAIL_DOMAIN})`,
  );
