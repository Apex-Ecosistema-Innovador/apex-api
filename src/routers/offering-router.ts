import { Router } from 'express';
import OfferingController from '../controllers/offering-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import Role from '../types/enums/roles';

function offeringRouter() {
  const router = Router();

  router.get('/public', OfferingController.listPublic);
  router.get('/mine', requireAuthentication, requireRoles([Role.Teacher]), OfferingController.listMine);
  router.post('/', requireAuthentication, requireRoles([Role.Teacher]), OfferingController.create);
  router.get(
    '/:offeringId/ranking',
    requireAuthentication,
    requireRoles([Role.Student, Role.Teacher]),
    OfferingController.ranking,
  );
  router.patch('/:id', requireAuthentication, requireRoles([Role.Teacher]), OfferingController.update);

  return router;
}

export default offeringRouter;
