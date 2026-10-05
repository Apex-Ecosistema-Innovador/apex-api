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

export const loginSchema = z.object({
  cedula: cedulaSchema,
  password: z.string().min(1),
});

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

export type RegisterStudentInput = z.output<typeof registerStudentSchema>;
export type RegisterTeacherInput = z.output<typeof registerTeacherSchema>;
export type LoginInput = z.output<typeof loginSchema>;
