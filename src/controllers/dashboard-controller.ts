import { Request, Response } from 'express';
import BaseController from './base-controller';
import DashboardService from '../services/dashboard-service';
import { validate } from '../validators/validate';
import { paginationSchema, uuidSchema } from '../validators/common';
import { exportQuerySchema, studentsQuerySchema } from '../validators/dashboard-validator';

class DashboardController {
  public static async students(req: Request, res: Response) {
    const query = validate(studentsQuerySchema, req.query);
    const { rows, total } = await DashboardService.students(req.auth!.userId, query);
    BaseController.handleSuccess(res, { payload: rows, total, page: query.page, limit: query.limit });
  }

  public static async exportCsv(req: Request, res: Response) {
    const csv = await DashboardService.exportCsv(req.auth!.userId, validate(exportQuerySchema, req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="polipuntos.csv"');
    res.send(csv);
  }

  public static async studentDetail(req: Request, res: Response) {
    const query = validate(paginationSchema, req.query);
    const { detail, total } = await DashboardService.studentDetail(
      req.auth!.userId,
      validate(uuidSchema, req.params.studentId),
      query,
    );
    BaseController.handleSuccess(res, { payload: detail, total, page: query.page, limit: query.limit });
  }
}

export default DashboardController;
