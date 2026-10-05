# apex-api

Backend centralizado del ecosistema APEX. Primer consumidor: `polipuntos-web`.

## Requisitos
Node 24+, Docker (Postgres local) o un proyecto Supabase (usar el connection pooler en `DATABASE_URL`).

## Puesta en marcha
```
cp .env.example .env
pnpm install
pnpm db:up
pnpm migrate:latest
pnpm seed:super-admin
pnpm dev
```

## Scripts
`dev`, `build`, `start`, `typecheck`, `lint`, `test`, `migrate:*`, `seed:super-admin`.

## Arquitectura
`routers → controllers → services → repositories` con validación Zod en controllers, errores `CustomError` centralizados y respuestas `{ message, payload, page, limit, total }`. API bajo `/api/v1`.

## Roles
`student`, `teacher`, `admin`, `super_admin`. Los profesores sin código de invitación quedan en `pending_approval` hasta que un admin los apruebe. Solo `super_admin` crea administradores.

## Polipuntos
Cada asignación pertenece a una asignatura (offering) de un profesor; los totales por asignatura y global se calculan sobre asignaciones no revertidas. Límite por asignación: `MAX_POINTS_PER_AWARD` (1000 por defecto).

## Base de datos y SSL
El cliente (Knex + `pg`) solo depende de `DATABASE_URL`. Para Supabase usa el connection pooler y activa SSL:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@<host>.pooler.supabase.com:6543/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=
```

`DB_SSL_CA` acepta el certificado en una línea con `\n` como separador de saltos de línea. En Postgres local déjalo en `false`.

## Modo offline
- `GET /polipoints/roster`: estudiantes inscritos del profesor y sus asignaturas activas, para que el dispositivo los guarde y pueda identificar un QR sin conexión.
- `POST /polipoints/awards/batch`: sincroniza asignaciones encoladas (`qrToken` o `studentId` para asignaciones manuales, `offeringId`, `points`, `idempotencyKey`, `occurredAt`). Responde un resultado por ítem (`created`, `duplicate`, `rejected`). La firma y versión del QR se validan aquí. Cada asignación guarda su origen en `source` (`qr` o `manual`). Se rechazan fechas futuras y anteriores a `OFFLINE_AWARD_MAX_AGE_DAYS` (7 por defecto).

## Sesiones y refresh tokens
El access token (JWT, 15 min) viaja en el header `Authorization` y el cliente lo guarda solo en memoria. El refresh token es opaco (48 bytes aleatorios), vive en la cookie `apex_refresh` (HttpOnly, path `/api/v1/auth`) y en la tabla `refresh_tokens` solo se guarda su hash SHA-256.

- Cada `POST /auth/refresh` marca el token como usado y emite uno nuevo de la misma familia (una familia por inicio de sesión).
- Reutilizar un token ya usado fuera de `REFRESH_REUSE_GRACE_SECONDS` (10 s por defecto, para respuestas perdidas o pestañas simultáneas) se trata como robo: se revoca toda la familia.
- `POST /auth/logout` revoca la familia. Deshabilitar a un profesor revoca todas sus sesiones.
- Los tokens vencidos de un usuario se eliminan cuando emite uno nuevo.
- Un access token ya emitido sigue siendo válido hasta que vence (15 min).

## Correo institucional y recuperación de contraseña
- El correo es obligatorio al registrarse (estudiantes, profesores y administradores) y debe terminar en `@${ALLOWED_EMAIL_DOMAIN}` (`elpoli.edu.co` por defecto). Se guarda en minúsculas y es único.
- `POST /auth/forgot-password { email }` responde siempre lo mismo, exista o no el correo. Si existe, envía un enlace `WEB_BASE_URL/restablecer-contrasena#token=…` válido `PASSWORD_RESET_TTL_MINUTES` (60). El token va en el fragmento de la URL para que no llegue a logs ni al `Referer`. Hay un enfriamiento de `PASSWORD_RESET_COOLDOWN_SECONDS` entre envíos y límite de peticiones por IP.
- `POST /auth/reset-password { token, password }` cambia la contraseña una sola vez, invalida los demás enlaces y cierra todas las sesiones del usuario.
- `POST /auth/change-password { currentPassword, newPassword }` (autenticado) cierra las demás sesiones y deja abierta la del dispositivo actual.
- Los tokens de restablecimiento se guardan solo como hash SHA-256 (`password_reset_tokens`).

### Envío de correo
Se usa SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`); sirve con cualquier proveedor (Resend, Brevo, SES, Gmail con contraseña de aplicación). En producción `SMTP_HOST` es obligatorio. En desarrollo, sin SMTP, el correo se imprime en consola con el enlace. Para que los mensajes lleguen a `@elpoli.edu.co` y no caigan en spam, configura SPF y DKIM del dominio remitente.
