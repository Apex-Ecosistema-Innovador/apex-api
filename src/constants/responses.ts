import HttpStatus from '../types/enums/http-status';

export const Errors = {
  ValidationFailed: { status: HttpStatus.BadRequest, message: 'Datos inválidos' },
  InvalidCredentials: { status: HttpStatus.Unauthorized, message: 'Cédula o contraseña incorrecta' },
  Unauthenticated: { status: HttpStatus.Unauthorized, message: 'Sesión no válida' },
  Forbidden: { status: HttpStatus.Forbidden, message: 'No tienes permisos para esta acción' },
  AccountPending: { status: HttpStatus.Forbidden, message: 'Tu cuenta está pendiente de aprobación' },
  AccountDisabled: { status: HttpStatus.Forbidden, message: 'Tu cuenta está deshabilitada' },
  CedulaTaken: { status: HttpStatus.Conflict, message: 'Ya existe una cuenta con esa cédula' },
  EmailTaken: { status: HttpStatus.Conflict, message: 'Ya existe una cuenta con ese correo' },
  InvalidResetToken: {
    status: HttpStatus.BadRequest,
    message: 'El enlace para restablecer la contraseña no es válido o expiró. Solicita uno nuevo.',
  },
  WrongPassword: { status: HttpStatus.BadRequest, message: 'La contraseña actual no es correcta' },
  SamePassword: { status: HttpStatus.BadRequest, message: 'La nueva contraseña debe ser diferente a la actual' },
  InvalidInvite: { status: HttpStatus.BadRequest, message: 'El código de invitación no es válido o expiró' },
  EventNotFound: { status: HttpStatus.NotFound, message: 'Evento no encontrado' },
  RegistrationClosed: {
    status: HttpStatus.Conflict,
    message: 'Las inscripciones no están abiertas para este evento',
  },
  RulesOutdated: {
    status: HttpStatus.Conflict,
    message: 'El reglamento cambió mientras diligenciabas el formulario. Recarga la página y vuelve a aceptarlo',
  },
  DataConsentOutdated: {
    status: HttpStatus.Conflict,
    message: 'La autorización de tratamiento de datos cambió. Recarga la página y vuelve a aceptarla',
  },
  InvalidVerificationToken: {
    status: HttpStatus.BadRequest,
    message: 'El enlace de verificación no es válido o expiró. Solicita uno nuevo.',
  },
  UserNotFound: { status: HttpStatus.NotFound, message: 'Usuario no encontrado' },
  OfferingNotFound: { status: HttpStatus.NotFound, message: 'Asignatura no encontrada' },
  OfferingTaken: { status: HttpStatus.Conflict, message: 'Ya registraste esa asignatura en ese periodo' },
  OfferingInactive: { status: HttpStatus.Conflict, message: 'La asignatura no está activa' },
  OfferingNotCurrent: { status: HttpStatus.Conflict, message: 'La asignatura no pertenece al periodo vigente' },
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
  ScheduleUnreadable: {
    status: HttpStatus.BadRequest,
    message: 'No pudimos leer el horario. Sube el PDF original que descargas del portal académico.',
  },
  ScheduleNotYours: {
    status: HttpStatus.Forbidden,
    message: 'El documento de identidad del horario no coincide con el de tu cuenta',
  },
  ScheduleWrongTerm: {
    status: HttpStatus.Conflict,
    message: 'El horario no corresponde al periodo académico vigente',
  },
  ScheduleFileMissing: { status: HttpStatus.BadRequest, message: 'Adjunta el horario en PDF' },
  ScheduleFileTooLarge: { status: HttpStatus.BadRequest, message: 'El archivo es demasiado grande' },
  RankingForbidden: {
    status: HttpStatus.Forbidden,
    message: 'Solo los estudiantes inscritos y el profesor pueden ver el ranking',
  },
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
  ScheduleSaved: 'Horario cargado',
  ScheduleSynced: 'Horario actualizado',
  AwardCreated: 'Polipuntos asignados',
  AwardRevoked: 'Polipuntos revertidos',
  TeacherUpdated: 'Profesor actualizado',
  InviteCreated: 'Invitación creada',
  AdminCreated: 'Administrador creado',
  PasswordResetRequested: 'Si el correo está registrado, te enviamos las instrucciones para restablecer tu contraseña',
  PasswordReset: 'Contraseña actualizada. Ya puedes iniciar sesión',
  RegistrationCreated: 'Inscripción registrada. Revisa tu correo para verificar tu cuenta',
  EmailVerified: 'Correo verificado',
  VerificationResent:
    'Si el correo está registrado y pendiente de verificar, te enviamos un nuevo enlace de verificación',
  PasswordChanged: 'Contraseña actualizada',
  QrRotated: 'Código QR regenerado',
} as const;
