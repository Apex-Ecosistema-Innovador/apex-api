import rateLimit from 'express-rate-limit';
import { Errors } from '../constants/responses';
import { env } from '../config/env';

const buildLimiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { message: Errors.TooManyRequests.message },
  });

export const authLimiter = buildLimiter(15 * 60 * 1000, 30);

export const awardLimiter = buildLimiter(60 * 1000, 60);
