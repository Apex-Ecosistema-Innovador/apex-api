import { createHash, randomBytes } from 'crypto';

export const generateRefreshToken = () => randomBytes(48).toString('base64url');

export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');
