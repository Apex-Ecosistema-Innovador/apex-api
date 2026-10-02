import { Request, Response } from 'express';
import BaseController from './base-controller';
import EnrollmentService from '../services/enrollment-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { uuidSchema } from '../validators/common';
import { enrollmentSchema } from '../validators/offering-validator';

class EnrollmentController {
  public static async listMine(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await EnrollmentService.listMine(req.auth!.userId) });
  }

  public static async enroll(req: Request, res: Response) {
    const { offeringId } = validate(enrollmentSchema, req.body);
    await EnrollmentService.enroll(req.auth!.userId, offeringId);
    BaseController.handleSuccess(res, { statusCode: HttpStatus.Created, message: Successes.Enrolled });
  }

  public static async unenroll(req: Request, res: Response) {
    await EnrollmentService.unenroll(req.auth!.userId, validate(uuidSchema, req.params.offeringId));
    BaseController.handleSuccess(res, { message: Successes.Unenrolled });
  }
}

export default EnrollmentController;
