import { Request, Response } from 'express';
import BaseController from './base-controller';
import DashboardService from '../services/dashboard-service';
import { validate } from '../validators/validate';
import { uuidSchema } from '../validators/common';
import { studentsQuerySchema } from '../validators/dashboard-validator';

class DashboardController {
  public static async students(req: Request, res: Response) {
    const query = validate(studentsQuerySchema, req.query);
    const { rows, total } = await DashboardService.students(req.auth!.userId, query);
    BaseController.handleSuccess(res, { payload: rows, total, page: query.page, limit: query.limit });
  }

  public static async exportCsv(req: Request, res: Response) {
    const csv = await DashboardService.exportCsv(req.auth!.userId, validate(studentsQuerySchema, req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="polipuntos.csv"');
    res.send(csv);
  }

  public static async studentDetail(req: Request, res: Response) {
    const detail = await DashboardService.studentDetail(req.auth!.userId, validate(uuidSchema, req.params.studentId));
    BaseController.handleSuccess(res, { payload: detail });
  }
}

export default DashboardController;
