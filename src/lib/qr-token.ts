import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { QrPayload } from '../types/auth';

export function signQrToken(userId: string, version: number): string {
  return jwt.sign({ v: version, typ: 'qr' }, env.QR_SECRET, { subject: userId });
}

export function verifyQrToken(token: string): { userId: string; version: number } | null {
  try {
    const payload = jwt.verify(token, env.QR_SECRET) as QrPayload;
    if (payload.typ !== 'qr') return null;
    return { userId: payload.sub, version: payload.v };
  } catch {
    return null;
  }
}
