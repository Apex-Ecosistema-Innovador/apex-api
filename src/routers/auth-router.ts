import { Router } from 'express';
import AuthController from '../controllers/auth-controller';
import requireAuthentication from '../middlewares/require-authentication';
import { authLimiter, passwordResetLimiter } from '../middlewares/rate-limit';

function authRouter() {
  const router = Router();

  router.post('/register/student', authLimiter, AuthController.registerStudent);
  router.post('/register/teacher', authLimiter, AuthController.registerTeacher);
  router.post('/login', authLimiter, AuthController.login);
  router.post('/refresh', AuthController.refresh);
  router.post('/logout', AuthController.logout);
  router.post('/forgot-password', passwordResetLimiter, AuthController.forgotPassword);
  router.post('/reset-password', passwordResetLimiter, AuthController.resetPassword);
  router.post('/change-password', requireAuthentication, authLimiter, AuthController.changePassword);
  router.get('/me', requireAuthentication, AuthController.me);

  return router;
}

export default authRouter;
