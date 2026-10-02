import { z } from 'zod';
import { cedulaSchema, fullNameSchema, passwordSchema, paginationSchema } from './common';
import UserStatus from '../types/enums/user-status';

export const teachersQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
});

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(90).default(7),
});

export const createAdminSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
});

export type CreateAdminInput = z.output<typeof createAdminSchema>;
