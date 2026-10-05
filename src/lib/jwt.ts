import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import Role from '../types/enums/roles';

interface SessionPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): SessionPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as SessionPayload;
}
