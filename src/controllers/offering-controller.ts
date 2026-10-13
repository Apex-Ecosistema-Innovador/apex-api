import { Request, Response } from 'express';
import BaseController from './base-controller';
import OfferingService from '../services/offering-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { paginationSchema, uuidSchema } from '../validators/common';
import {
  createOfferingSchema,
  publicOfferingsQuerySchema,
  updateOfferingSchema,
} from '../validators/offering-validator';

class OfferingController {
  public static async listPublic(req: Request, res: Response) {
    const query = validate(publicOfferingsQuerySchema, req.query);
    const { rows, total } = await OfferingService.listPublic(query);
    BaseController.handleSuccess(res, { payload: rows, total, page: query.page, limit: query.limit });
  }

  public static async listMine(req: Request, res: Response) {
    const query = validate(paginationSchema, req.query);
    const { rows, total } = await OfferingService.listMine(req.auth!.userId, query);
    BaseController.handleSuccess(res, { payload: rows, total, page: query.page, limit: query.limit });
  }

  public static async create(req: Request, res: Response) {
    const offering = await OfferingService.create(req.auth!.userId, validate(createOfferingSchema, req.body));
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.OfferingCreated,
      payload: offering,
    });
  }

  public static async ranking(req: Request, res: Response) {
    const offeringId = validate(uuidSchema, req.params.offeringId);
    const query = validate(paginationSchema, req.query);
    const { rows, total, me } = await OfferingService.ranking(req.auth!, offeringId, query);
    BaseController.handleSuccess(res, {
      payload: { me, entries: rows },
      total,
      page: query.page,
      limit: query.limit,
    });
  }

  public static async update(req: Request, res: Response) {
    const id = validate(uuidSchema, req.params.id);
    const offering = await OfferingService.update(req.auth!.userId, id, validate(updateOfferingSchema, req.body));
    BaseController.handleSuccess(res, { message: Successes.OfferingUpdated, payload: offering });
  }
}

export default OfferingController;
