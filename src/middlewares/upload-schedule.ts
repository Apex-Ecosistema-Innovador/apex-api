import multer from 'multer';
import { RequestHandler } from 'express';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import { env } from '../config/env';

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.SCHEDULE_MAX_BYTES, files: 1, fields: 0 },
}).single('file');

const uploadSchedule: RequestHandler = (req, res, next) => {
  uploader(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const tooLarge = (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
    const failure = tooLarge ? Errors.ScheduleFileTooLarge : Errors.ScheduleFileMissing;
    next(new CustomError(failure.status, failure.message));
  });
};

export default uploadSchedule;
