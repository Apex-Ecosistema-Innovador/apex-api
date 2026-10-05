import { Router } from 'express';
import PolipointController from '../controllers/polipoint-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import { awardLimiter } from '../middlewares/rate-limit';
import Role from '../types/enums/roles';

function polipointRouter() {
  const router = Router();

  router.use(requireAuthentication);
  router.get('/me', requireRoles([Role.Student]), PolipointController.mySummary);
  router.get('/me/qr', requireRoles([Role.Student]), PolipointController.getQr);
  router.post('/me/qr/rotate', requireRoles([Role.Student]), PolipointController.rotateQr);
  router.post('/scan', requireRoles([Role.Teacher]), awardLimiter, PolipointController.scan);
  router.post('/awards', requireRoles([Role.Teacher]), awardLimiter, PolipointController.award);
  router.post('/awards/batch', requireRoles([Role.Teacher]), awardLimiter, PolipointController.awardBatch);
  router.get('/roster', requireRoles([Role.Teacher]), PolipointController.roster);
  router.post(
    '/awards/:id/revoke',
    requireRoles([Role.Teacher, Role.Admin, Role.SuperAdmin]),
    PolipointController.revoke,
  );

  return router;
}

export default polipointRouter;
