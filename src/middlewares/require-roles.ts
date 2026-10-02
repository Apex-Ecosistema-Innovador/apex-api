import { RequestHandler } from 'express';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import Role from '../types/enums/roles';

const requireRoles =
  (roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(new CustomError(Errors.Forbidden.status, Errors.Forbidden.message));
      return;
    }
    next();
  };

export default requireRoles;
