import { env } from '../config/env';

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export const termFor = (date: Date) => {
  const local = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${local.getUTCMonth() < 6 ? 1 : 2}`;
};

export const currentTerm = (now: Date = new Date()) => env.CURRENT_TERM ?? termFor(now);
