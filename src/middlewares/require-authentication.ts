import { RequestHandler } from 'express';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import { verifyAccessToken } from '../lib/jwt';

const requireAuthentication: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    next(new CustomError(Errors.Unauthenticated.status, Errors.Unauthenticated.message));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(new CustomError(Errors.Unauthenticated.status, Errors.Unauthenticated.message));
  }
};

export default requireAuthentication;
