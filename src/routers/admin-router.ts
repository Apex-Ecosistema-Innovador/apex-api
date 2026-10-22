import { Router } from 'express';
import AdminController from '../controllers/admin-controller';
import requireAuthentication from '../middlewares/require-authentication';
import requireRoles from '../middlewares/require-roles';
import Role from '../types/enums/roles';

function adminRouter() {
  const router = Router();

  router.use(requireAuthentication);
  router.get('/teachers', requireRoles([Role.Admin, Role.SuperAdmin]), AdminController.listTeachers);
  router.patch('/teachers/:id/approve', requireRoles([Role.Admin, Role.SuperAdmin]), AdminController.approveTeacher);
  router.patch('/teachers/:id/disable', requireRoles([Role.Admin, Role.SuperAdmin]), AdminController.disableTeacher);
  router.post('/invites', requireRoles([Role.Admin, Role.SuperAdmin]), AdminController.createInvite);
  router.get('/hackathon/inscripciones', requireRoles([Role.SuperAdmin]), AdminController.listInscripciones);
  router.get('/hackathon/inscripciones/resumen', requireRoles([Role.SuperAdmin]), AdminController.resumenInscripciones);
  router.post('/admins', requireRoles([Role.SuperAdmin]), AdminController.createAdmin);

  return router;
}

export default adminRouter;
