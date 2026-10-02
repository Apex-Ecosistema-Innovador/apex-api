import { Router } from 'express';
import EnrollmentController from '../controllers/enrollment-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import Role from '../types/enums/roles';

function enrollmentRouter() {
  const router = Router();

  router.use(requireAuthentication, requireRoles([Role.Student]));
  router.get('/mine', EnrollmentController.listMine);
  router.post('/', EnrollmentController.enroll);
  router.delete('/:offeringId', EnrollmentController.unenroll);

  return router;
}

export default enrollmentRouter;
