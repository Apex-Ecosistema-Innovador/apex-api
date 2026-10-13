import { Request, Response } from 'express';
import BaseController from './base-controller';
import ScheduleService from '../services/schedule-service';
import CustomError from '../types/custom-error';
import HttpStatus from '../types/enums/http-status';
import { Errors, Successes } from '../constants/responses';

class ScheduleController {
  public static async current(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await ScheduleService.overview(req.auth!.userId) });
  }

  public static async upload(req: Request, res: Response) {
    if (!req.file) throw new CustomError(Errors.ScheduleFileMissing.status, Errors.ScheduleFileMissing.message);
    const overview = await ScheduleService.upload(req.auth!.userId, req.file.buffer);
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.ScheduleSaved,
      payload: overview,
    });
  }

  public static async sync(req: Request, res: Response) {
    BaseController.handleSuccess(res, {
      message: Successes.ScheduleSynced,
      payload: await ScheduleService.sync(req.auth!.userId),
    });
  }
}

export default ScheduleController;
