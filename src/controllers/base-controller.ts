import { Response } from 'express';
import HttpStatus from '../types/enums/http-status';
import { ResponseSuccess } from '../types/api-response';

class BaseController {
  public static handleSuccess<Payload>(res: Response, response: ResponseSuccess<Payload>): void {
    const { statusCode = HttpStatus.Success, message, payload, page, limit, total } = response;
    res.status(statusCode).json({ message, payload, page, limit, total });
  }
}

export default BaseController;
