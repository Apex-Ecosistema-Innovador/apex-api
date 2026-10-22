import { z } from 'zod';
import {
  cedulaSchema,
  fullNameSchema,
  institutionalEmailSchema,
  passwordSchema,
  paginationSchema,
  uuidSchema,
} from './common';
import UserStatus from '../types/enums/user-status';
import EstadoInscripcion from '../types/enums/estado-inscripcion';

export const teachersQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
});

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(90).default(7),
});

export const createAdminSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  email: institutionalEmailSchema,
  password: passwordSchema,
});

export const inscripcionesQuerySchema = paginationSchema.extend({
  hackathonId: uuidSchema.optional(),
  estado: z.nativeEnum(EstadoInscripcion).optional(),
  verificado: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const resumenInscripcionesQuerySchema = z.object({
  hackathonId: uuidSchema.optional(),
});
