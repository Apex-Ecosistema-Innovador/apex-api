import { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE = 'apex_refresh';

const options = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/v1/auth',
});

export const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, { ...options(), maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 });

export const clearRefreshCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, options());
