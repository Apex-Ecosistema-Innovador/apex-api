import type { z } from 'zod';
import type { createOfferingSchema, updateOfferingSchema } from '../validators/offering-validator';
import type { createAdminSchema } from '../validators/admin-validator';
import type { offlineAwardSchema, createAwardSchema } from '../validators/polipoint-validator';
import type { studentsQuerySchema } from '../validators/dashboard-validator';
import type { registerStudentSchema, registerTeacherSchema, loginSchema } from '../validators/auth-validator';

export type CreateOfferingInput = z.output<typeof createOfferingSchema>;
export type UpdateOfferingInput = z.output<typeof updateOfferingSchema>;
export type CreateAdminInput = z.output<typeof createAdminSchema>;
export type OfflineAwardInput = z.output<typeof offlineAwardSchema>;
export type CreateAwardInput = z.output<typeof createAwardSchema>;
export type StudentsQuery = z.output<typeof studentsQuerySchema>;
export type RegisterStudentInput = z.output<typeof registerStudentSchema>;
export type RegisterTeacherInput = z.output<typeof registerTeacherSchema>;
export type LoginInput = z.output<typeof loginSchema>;
