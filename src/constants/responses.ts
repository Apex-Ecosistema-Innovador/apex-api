import HttpStatus from '../types/enums/http-status';

export const Errors = {
  ValidationFailed: { status: HttpStatus.BadRequest, message: 'Datos inválidos' },
  InvalidCredentials: { status: HttpStatus.Unauthorized, message: 'Cédula o contraseña incorrecta' },
  Unauthenticated: { status: HttpStatus.Unauthorized, message: 'Sesión no válida' },
  Forbidden: { status: HttpStatus.Forbidden, message: 'No tienes permisos para esta acción' },
  AccountPending: { status: HttpStatus.Forbidden, message: 'Tu cuenta está pendiente de aprobación' },
  AccountDisabled: { status: HttpStatus.Forbidden, message: 'Tu cuenta está deshabilitada' },
  CedulaTaken: { status: HttpStatus.Conflict, message: 'Ya existe una cuenta con esa cédula' },
  InvalidInvite: { status: HttpStatus.BadRequest, message: 'El código de invitación no es válido o expiró' },
  UserNotFound: { status: HttpStatus.NotFound, message: 'Usuario no encontrado' },
  OfferingNotFound: { status: HttpStatus.NotFound, message: 'Asignatura no encontrada' },
  OfferingTaken: { status: HttpStatus.Conflict, message: 'Ya registraste esa asignatura en ese periodo' },
  OfferingInactive: { status: HttpStatus.Conflict, message: 'La asignatura no está activa' },
  AlreadyEnrolled: { status: HttpStatus.Conflict, message: 'Ya estás inscrito en esta asignatura' },
  NotEnrolled: { status: HttpStatus.NotFound, message: 'El estudiante no está inscrito en esta asignatura' },
  EnrollmentHasPoints: {
    status: HttpStatus.Conflict,
    message: 'No puedes salir de una asignatura con polipuntos asignados',
  },
  InvalidQr: {
    status: HttpStatus.BadRequest,
    message:
      'Este QR ya no es válido. Pídele al estudiante que lo regenere o que se conecte a internet para actualizarlo.',
  },
  AwardNotFound: { status: HttpStatus.NotFound, message: 'Registro de polipuntos no encontrado' },
  AwardAlreadyRevoked: { status: HttpStatus.Conflict, message: 'Estos polipuntos ya fueron revertidos' },
  AwardTooOld: { status: HttpStatus.BadRequest, message: 'La fecha del registro es demasiado antigua' },
  AwardInFuture: { status: HttpStatus.BadRequest, message: 'La fecha del registro es inválida' },
  PointsOutOfRange: { status: HttpStatus.BadRequest, message: 'Cantidad de polipuntos fuera de rango' },
  RouteNotFound: { status: HttpStatus.NotFound, message: 'Ruta no encontrada' },
  Internal: { status: HttpStatus.InternalServerError, message: 'Error interno del servidor' },
  TooManyRequests: { status: HttpStatus.TooManyRequests, message: 'Demasiadas solicitudes, intenta más tarde' },
} as const;

export const Successes = {
  Registered: 'Cuenta creada',
  LoggedIn: 'Sesión iniciada',
  LoggedOut: 'Sesión cerrada',
  OfferingCreated: 'Asignatura creada',
  OfferingUpdated: 'Asignatura actualizada',
  Enrolled: 'Inscripción realizada',
  Unenrolled: 'Inscripción eliminada',
  AwardCreated: 'Polipuntos asignados',
  AwardRevoked: 'Polipuntos revertidos',
  TeacherUpdated: 'Profesor actualizado',
  InviteCreated: 'Invitación creada',
  AdminCreated: 'Administrador creado',
  QrRotated: 'Código QR regenerado',
} as const;
