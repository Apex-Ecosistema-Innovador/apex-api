import Role from './enums/roles';
import { PublicUser } from './models';

export interface SessionPayload {
  sub: string;
  role: Role;
}

export interface QrPayload {
  sub: string;
  v: number;
  typ: 'qr';
}

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
