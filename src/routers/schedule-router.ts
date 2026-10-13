import { Router } from 'express';
import ScheduleController from '../controllers/schedule-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import uploadSchedule from '../middlewares/upload-schedule';
import { scheduleLimiter } from '../middlewares/rate-limit';
import Role from '../types/enums/roles';

function scheduleRouter() {
  const router = Router();

  router.use(requireAuthentication, requireRoles([Role.Student]));
  router.get('/current', ScheduleController.current);
  router.post('/', scheduleLimiter, uploadSchedule, ScheduleController.upload);
  router.post('/sync', scheduleLimiter, ScheduleController.sync);

  return router;
}

export default scheduleRouter;
