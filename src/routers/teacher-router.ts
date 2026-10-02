import { Router } from 'express';
import DashboardController from '../controllers/dashboard-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import Role from '../types/enums/roles';

function teacherRouter() {
  const router = Router();

  router.use(requireAuthentication, requireRoles([Role.Teacher]));
  router.get('/students', DashboardController.students);
  router.get('/students/export', DashboardController.exportCsv);
  router.get('/students/:studentId', DashboardController.studentDetail);

  return router;
}

export default teacherRouter;
