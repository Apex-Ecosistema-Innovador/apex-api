import Role from './enums/roles';
import UserStatus from './enums/user-status';
import AwardSource from './enums/award-source';

export interface User {
  id: string;
  cedula: string;
  full_name: string;
  full_name_search: string;
  email: string | null;
  password_hash: string;
  role: Role;
  status: UserStatus;
  qr_token_version: number;
  created_at: Date;
  updated_at: Date;
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
  teacher_id: string;
  course_code: string;
  course_name: string;
  term: string;
  active: boolean;
  created_at: Date;
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
  student_id: string;
  offering_id: string;
  teacher_id: string;
  points: number;
  reason: string | null;
  idempotency_key: string;
  created_at: Date;
  occurred_at: Date;
  source: AwardSource;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}
