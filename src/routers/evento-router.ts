import { Router } from 'express';
import EventoController from '../controllers/evento-controller';
import { registrationLimiter } from '../middlewares/rate-limit';

function eventoRouter() {
  const router = Router();

  router.get('/:eventoId', EventoController.obtener);
  router.post('/:eventoId/inscripciones', registrationLimiter, EventoController.inscribir);

  return router;
}

export default eventoRouter;
