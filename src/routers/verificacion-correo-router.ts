import { Router } from 'express';
import VerificacionCorreoController from '../controllers/verificacion-correo-controller';
import { verificationLimiter } from '../middlewares/rate-limit';

function verificacionCorreoRouter() {
  const router = Router();

  router.post('/', verificationLimiter, VerificacionCorreoController.verificar);
  router.post('/reenvio', verificationLimiter, VerificacionCorreoController.reenviar);

  return router;
}

export default verificacionCorreoRouter;
