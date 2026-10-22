import { z } from 'zod';
import { cedulaSchema, fullNameSchema, institutionalEmailSchema, passwordSchema, uuidSchema } from './common';

export const registerStudentSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  email: institutionalEmailSchema,
  password: passwordSchema,
  offeringIds: z.array(uuidSchema).max(30).default([]),
});

export const registerTeacherSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  email: institutionalEmailSchema,
  password: passwordSchema,
  inviteCode: z.string().trim().min(1).max(40).optional(),
});

const identifierSchema = z.string().trim().min(1).max(254);

export const loginSchema = z
  .object({
    identifier: identifierSchema.optional(),
    cedula: identifierSchema.optional(),
    password: z.string().min(1),
  })
  .refine((value) => value.identifier ?? value.cedula, 'Ingresa tu cédula o correo')
  .transform((value) => ({ identifier: (value.identifier ?? value.cedula)!, password: value.password }));

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: passwordSchema,
});
