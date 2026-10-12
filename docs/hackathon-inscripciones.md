# Módulo: inscripciones de la hackathon

## Responsabilidad
Registra a un estudiante en un evento: crea su cuenta de hackathon, guarda la inscripción en estado PENDIENTE con la versión del reglamento y de la autorización de datos que aceptó, y verifica su correo.

No hace: inicio de sesión, aprobación o rechazo (RF-IN-03), cupo y lista de espera (RF-IN-04), equipos, membresías ni recuperación de contraseña.

## Interfaz pública
- `GET /api/v1/eventos/:eventoId`: datos públicos del evento y versiones vigentes. 404 si está en BORRADOR o CANCELADO.
- `POST /api/v1/eventos/:eventoId/inscripciones`: cuenta + inscripción. 201 con `{ inscripcionId, estado, correoVerificado }`.
- `POST /api/v1/verificacion-correo` `{ token }`: marca el correo como verificado. El enlace es de un solo uso y vence a las 24 horas (`EMAIL_VERIFICATION_TTL_HOURS`).
- `POST /api/v1/verificacion-correo/reenvio` `{ correo }`: respuesta genérica; respeta un tiempo de espera (`EMAIL_VERIFICATION_COOLDOWN_SECONDS`).

Los consume `apex-web` (`/hackathon/inscripcion`, `/hackathon/verificar-correo`).

## Eventos de dominio
Ninguno. El correo de verificación se envía directamente tras el commit; si falla, se registra y la inscripción se conserva.

## Reglas de negocio implementadas
- Solo se inscribe quien llega con el evento en fase INSCRIPCIONES, validado dentro de la transacción: v1.0 §6.1 (matriz de acciones por fase).
- La hora de aceptación (`aceptado_en`) la asigna la base de datos: v1.0 §6.2.
- El reglamento se acepta por versión y la autorización de datos se registra aparte; la imagen es un consentimiento independiente: v1.0 RF-EV-04, RNF-DAT-01, RNF-DAT-06.
- El formulario no pide documento de identidad, ciudad ni disponibilidad: v1.0 §8.2. `tecnologias` y `nivel_experiencia` existen en la tabla pero no se piden (se justifican solo con RF-EQ-10).
- Un correo no puede repetirse, ni cambiando mayúsculas: v1.0 §6.7 (la garantía es de base de datos).
- Correo institucional obligatorio: v1.0 RF-ID-01.

## Tablas
`usuarios`, `hackathones`, `inscripciones`, `tokens_usuario` (migración `20261010000001_hackathon_inscripciones.ts`).

## Decisiones no obvias
- El token de verificación se guarda como hash SHA-256 y viaja en el fragmento de la URL (`#token=`) para que no llegue a logs de servidor ni al encabezado Referer.
- `FOR SHARE` sobre la fila del evento: una transición de fase (que hará `UPDATE`) espera a que terminen los registros en curso, y un registro nunca ve una fase que cambió a mitad de la transacción.
- Dos registros simultáneos con el mismo correo: el índice único `lower(correo)` deja pasar uno y rechaza el otro con 409. La validación en el servicio no es equivalente.
- Reenviar la verificación responde igual exista o no el correo, para no revelar qué correos están registrados. El registro, en cambio, sí informa que el correo ya existe (409), por usabilidad.
- Un correo que ya tiene cuenta no puede inscribirse a otro evento hasta que exista el inicio de sesión (RF-ID-02).

## Costuras para fases siguientes
- `inscripciones.estado` ya admite APROBADA, RECHAZADA y EN_LISTA_ESPERA; falta la lógica de aprobación (RF-IN-03) y el correo de aprobación.
- Falta crear la membresía PARTICIPANTE. La v1.0 no dice si nace al inscribirse o al aprobar; está sin decidir y requiere un ADR.
- `tokens_usuario.tipo` ya incluye RECUPERACION_CONTRASENA para RF-ID-03.
- El enum `etapa` está creado pero sin tablas que lo usen.
- Datos de prueba: `pnpm seed:hackathon` crea un evento en INSCRIPCIONES con las variables `HACKATHON_*` de `.env.example` (los tamaños de equipo son provisionales hasta confirmar con el comité, v1.0 §15.4).
