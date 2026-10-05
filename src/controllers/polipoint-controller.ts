import { Request, Response } from 'express';
import BaseController from './base-controller';
import PolipointService from '../services/polipoint-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { uuidSchema } from '../validators/common';
import { batchAwardsSchema, createAwardSchema, revokeAwardSchema, scanSchema } from '../validators/polipoint-validator';

class PolipointController {
  public static async getQr(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await PolipointService.getQr(req.auth!.userId) });
  }

  public static async rotateQr(req: Request, res: Response) {
    BaseController.handleSuccess(res, {
      message: Successes.QrRotated,
      payload: await PolipointService.rotateQr(req.auth!.userId),
    });
  }

  public static async scan(req: Request, res: Response) {
    const { token } = validate(scanSchema, req.body);
    BaseController.handleSuccess(res, { payload: await PolipointService.scan(req.auth!.userId, token) });
  }

  public static async award(req: Request, res: Response) {
    const award = await PolipointService.award(req.auth!.userId, validate(createAwardSchema, req.body));
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.AwardCreated,
      payload: award,
    });
  }

  public static async awardBatch(req: Request, res: Response) {
    const { items } = validate(batchAwardsSchema, req.body);
    BaseController.handleSuccess(res, { payload: await PolipointService.awardBatch(req.auth!.userId, items) });
  }

  public static async roster(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await PolipointService.roster(req.auth!.userId) });
  }

  public static async revoke(req: Request, res: Response) {
    const { reason } = validate(revokeAwardSchema, req.body ?? {});
    const award = await PolipointService.revoke(
      req.auth!.userId,
      req.auth!.role,
      validate(uuidSchema, req.params.id),
      reason,
    );
    BaseController.handleSuccess(res, { message: Successes.AwardRevoked, payload: award });
  }

  public static async mySummary(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await PolipointService.mySummary(req.auth!.userId) });
  }
}

export default PolipointController;
