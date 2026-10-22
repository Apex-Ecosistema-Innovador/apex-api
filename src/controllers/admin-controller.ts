import { Request, Response } from 'express';
import BaseController from './base-controller';
import AdminService from '../services/admin-service';
import HttpStatus from '../types/enums/http-status';
import UserStatus from '../types/enums/user-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { uuidSchema } from '../validators/common';
import {
  createAdminSchema,
  createInviteSchema,
  inscripcionesQuerySchema,
  resumenInscripcionesQuerySchema,
  teachersQuerySchema,
} from '../validators/admin-validator';

class AdminController {
  public static async listTeachers(req: Request, res: Response) {
    const { status, page, limit } = validate(teachersQuerySchema, req.query);
    const { teachers, total } = await AdminService.listTeachers(status, page, limit);
    BaseController.handleSuccess(res, { payload: teachers, total, page, limit });
  }

  public static async listInscripciones(req: Request, res: Response) {
    const { page, limit, ...filtros } = validate(inscripcionesQuerySchema, req.query);
    const { rows, total } = await AdminService.listInscripciones(filtros, page, limit);
    BaseController.handleSuccess(res, { payload: rows, total, page, limit });
  }

  public static async resumenInscripciones(req: Request, res: Response) {
    const { hackathonId } = validate(resumenInscripcionesQuerySchema, req.query);
    BaseController.handleSuccess(res, { payload: await AdminService.resumenInscripciones(hackathonId) });
  }

  public static async approveTeacher(req: Request, res: Response) {
    const teacher = await AdminService.setTeacherStatus(validate(uuidSchema, req.params.id), UserStatus.Active);
    BaseController.handleSuccess(res, { message: Successes.TeacherUpdated, payload: teacher });
  }

  public static async disableTeacher(req: Request, res: Response) {
    const teacher = await AdminService.setTeacherStatus(validate(uuidSchema, req.params.id), UserStatus.Disabled);
    BaseController.handleSuccess(res, { message: Successes.TeacherUpdated, payload: teacher });
  }

  public static async createInvite(req: Request, res: Response) {
    const { expiresInDays } = validate(createInviteSchema, req.body ?? {});
    const invite = await AdminService.createInvite(req.auth!.userId, expiresInDays);
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.InviteCreated,
      payload: invite,
    });
  }

  public static async createAdmin(req: Request, res: Response) {
    const admin = await AdminService.createAdmin(validate(createAdminSchema, req.body));
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.AdminCreated,
      payload: admin,
    });
  }
}

export default AdminController;
