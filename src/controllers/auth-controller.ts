import { Request, Response } from 'express';
import BaseController from './base-controller';
import AuthService, { Session } from '../services/auth-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { loginSchema, registerStudentSchema, registerTeacherSchema } from '../validators/auth-validator';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from '../lib/refresh-cookie';

const respondWithSession = (res: Response, session: Session, statusCode: HttpStatus, message: string) => {
  setRefreshCookie(res, session.refreshToken);
  BaseController.handleSuccess(res, {
    statusCode,
    message,
    payload: { user: session.user, accessToken: session.accessToken },
  });
};

class AuthController {
  public static async registerStudent(req: Request, res: Response) {
    const session = await AuthService.registerStudent(validate(registerStudentSchema, req.body));
    respondWithSession(res, session, HttpStatus.Created, Successes.Registered);
  }

  public static async registerTeacher(req: Request, res: Response) {
    const { user, session } = await AuthService.registerTeacher(validate(registerTeacherSchema, req.body));

    if (session) {
      respondWithSession(res, session, HttpStatus.Created, Successes.Registered);
      return;
    }

    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.Registered,
      payload: { user },
    });
  }

  public static async login(req: Request, res: Response) {
    const session = await AuthService.login(validate(loginSchema, req.body));
    respondWithSession(res, session, HttpStatus.Success, Successes.LoggedIn);
  }

  public static async refresh(req: Request, res: Response) {
    const session = await AuthService.refresh(req.cookies?.[REFRESH_COOKIE]);
    respondWithSession(res, session, HttpStatus.Success, Successes.LoggedIn);
  }

  public static async logout(req: Request, res: Response) {
    await AuthService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    BaseController.handleSuccess(res, { message: Successes.LoggedOut });
  }

  public static async me(req: Request, res: Response) {
    const user = await AuthService.me(req.auth!.userId);
    BaseController.handleSuccess(res, { payload: { user } });
  }
}

export default AuthController;
