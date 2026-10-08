import Role from './enums/roles';
import UserStatus from './enums/user-status';
import AwardSource from './enums/award-source';

export interface CreateRefreshTokenData {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface CreateUserData {
  cedula: string;
  fullName: string;
  fullNameSearch: string;
  email?: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
}

export interface RosterRow {
  studentId: string;
  fullName: string;
  cedula: string;
  offeringId: string;
}

export interface Invite {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  expiresAt: Date;
}

export interface DashboardRow {
  studentId: string;
  fullName: string;
  cedula: string;
  offeringId: string;
  courseCode: string;
  courseName: string;
  term: string;
  points: number;
}

export interface CreateAwardData {
  studentId: string;
  offeringId: string;
  teacherId: string;
  points: number;
  reason?: string;
  idempotencyKey: string;
  occurredAt?: Date;
  source?: AwardSource;
}

export interface AwardHistoryRow {
  id: string;
  points: number;
  reason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  courseCode: string;
  courseName: string;
  term: string;
  teacherName: string;
}

export interface OfferingTotalRow {
  offeringId: string;
  courseCode: string;
  courseName: string;
  term: string;
  teacherName: string;
  points: number;
}
