import { z } from 'zod';
import { cedulaSchema, fullNameSchema, passwordSchema, uuidSchema } from './common';

export const registerStudentSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  email: z.string().trim().email().optional(),
  password: passwordSchema,
  offeringIds: z.array(uuidSchema).max(30).default([]),
});

export const registerTeacherSchema = z.object({
  cedula: cedulaSchema,
  fullName: fullNameSchema,
  email: z.string().trim().email().optional(),
  password: passwordSchema,
  inviteCode: z.string().trim().min(1).max(40).optional(),
});

export const loginSchema = z.object({
  cedula: cedulaSchema,
  password: z.string().min(1),
});

export type RegisterStudentInput = z.output<typeof registerStudentSchema>;
export type RegisterTeacherInput = z.output<typeof registerTeacherSchema>;
export type LoginInput = z.output<typeof loginSchema>;
