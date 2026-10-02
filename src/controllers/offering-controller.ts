import { Request, Response } from 'express';
import BaseController from './base-controller';
import OfferingService from '../services/offering-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { uuidSchema } from '../validators/common';
import {
  createOfferingSchema,
  publicOfferingsQuerySchema,
  updateOfferingSchema,
} from '../validators/offering-validator';

class OfferingController {
  public static async listPublic(req: Request, res: Response) {
    const { q } = validate(publicOfferingsQuerySchema, req.query);
    BaseController.handleSuccess(res, { payload: await OfferingService.listPublic(q) });
  }

  public static async listMine(req: Request, res: Response) {
    BaseController.handleSuccess(res, { payload: await OfferingService.listMine(req.auth!.userId) });
  }

  public static async create(req: Request, res: Response) {
    const offering = await OfferingService.create(req.auth!.userId, validate(createOfferingSchema, req.body));
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.OfferingCreated,
      payload: offering,
    });
  }

  public static async update(req: Request, res: Response) {
    const id = validate(uuidSchema, req.params.id);
    const offering = await OfferingService.update(req.auth!.userId, id, validate(updateOfferingSchema, req.body));
    BaseController.handleSuccess(res, { message: Successes.OfferingUpdated, payload: offering });
  }
}

export default OfferingController;
