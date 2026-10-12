import { Request, Response } from 'express';
import BaseController from './base-controller';
import InscripcionService from '../services/inscripcion-service';
import HttpStatus from '../types/enums/http-status';
import { Successes } from '../constants/responses';
import { validate } from '../validators/validate';
import { eventoParamsSchema, registroInscripcionSchema } from '../validators/inscripcion-validator';

class EventoController {
  public static async obtener(req: Request, res: Response) {
    const { eventoId } = validate(eventoParamsSchema, req.params);
    BaseController.handleSuccess(res, { payload: await InscripcionService.obtenerEvento(eventoId) });
  }

  public static async inscribir(req: Request, res: Response) {
    const { eventoId } = validate(eventoParamsSchema, req.params);
    const resultado = await InscripcionService.registrar(eventoId, validate(registroInscripcionSchema, req.body));
    BaseController.handleSuccess(res, {
      statusCode: HttpStatus.Created,
      message: Successes.RegistrationCreated,
      payload: resultado,
    });
  }
}

export default EventoController;
