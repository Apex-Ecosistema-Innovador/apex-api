import { Request, Response } from 'express';
import BaseController from './base-controller';
import InscripcionService from '../services/inscripcion-service';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { reenviarVerificacionSchema, verificarCorreoSchema } from '../validators/inscripcion-validator';

class VerificacionCorreoController {
  public static async verificar(req: Request, res: Response) {
    const { token } = validate(verificarCorreoSchema, req.body);
    await InscripcionService.verificarCorreo(token);
    BaseController.handleSuccess(res, { message: Successes.EmailVerified });
  }

  public static async reenviar(req: Request, res: Response) {
    const { correo } = validate(reenviarVerificacionSchema, req.body);
    await InscripcionService.reenviarVerificacion(correo);
    BaseController.handleSuccess(res, { message: Successes.VerificationResent });
  }
}

export default VerificacionCorreoController;
