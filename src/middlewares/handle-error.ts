import { ErrorRequestHandler, RequestHandler } from 'express';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import { env } from '../config/env';

export const handleNotFound: RequestHandler = (_req, _res, next) => {
  next(new CustomError(Errors.RouteNotFound.status, Errors.RouteNotFound.message));
};

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof CustomError) {
    res.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }

  if (!env.isTest) {
    console.error(error);
  }

  res.status(Errors.Internal.status).json({ message: Errors.Internal.message });
};

export default handleError;
