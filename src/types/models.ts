import Role from './enums/roles';
import UserStatus from './enums/user-status';
import AwardSource from './enums/award-source';

export interface User {
  id: string;
  cedula: string;
  fullName: string;
  fullNameSearch: string;
  email: string | null;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  qrTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  cedula: string;
  fullName: string;
  email: string | null;
  role: Role;
  status: UserStatus;
}

export interface Offering {
  id: string;
  teacherId: string;
  courseCode: string;
  courseName: string;
  term: string;
  active: boolean;
  createdAt: Date;
}

export interface PublicOffering {
  id: string;
  courseCode: string;
  courseName: string;
  term: string;
  active: boolean;
  teacher: { id: string; fullName: string };
}

export interface PolipointAward {
  id: string;
  studentId: string;
  offeringId: string;
  teacherId: string;
  points: number;
  reason: string | null;
  idempotencyKey: string;
  createdAt: Date;
  occurredAt: Date;
  source: AwardSource;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
