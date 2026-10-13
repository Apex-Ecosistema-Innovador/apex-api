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
Las consultas se escriben como SQL parametrizado (`$1, $2…`) en los repositorios sobre un `pg.Pool` único (`src/lib/database.ts`); las columnas se mapean a camelCase con `AS` en el propio SQL. Knex se usa solo para migraciones y seeds. La conexión depende de `DATABASE_URL`. Para Supabase usa el connection pooler y activa SSL:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@<host>.pooler.supabase.com:6543/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=
```

`DB_POOL_MAX` (por defecto 10) limita las conexiones del pool; con el pooler de Supabase en modo transacción (puerto 6543) conviene bajarlo, por ejemplo a 5. `DB_POOL_IDLE_TIMEOUT_MS` (30000) cierra las inactivas.

`DB_SSL_CA` acepta el certificado en una línea con `\n` como separador de saltos de línea. En Postgres local déjalo en `false`.

## Paginación y límites
Todos los listados reciben `page` y `limit` (el front siempre los envía) y el backend los valida con Zod: `limit` entre 1 y 100 (20 por defecto), `page` entre 1 y 100000. Una petición fuera de rango responde 400. La exportación CSV acepta `limit` hasta 5000 filas. Los listados paginados son `/offerings/public`, `/offerings/mine`, `/enrollments/mine`, `/polipoints/roster`, `/polipoints/me` (historial), `/teacher/students`, `/teacher/students/:id` (historial) y `/admin/teachers`; la respuesta incluye `total`, `page` y `limit`. Las consultas SQL se escriben parametrizadas y una regla de ESLint prohíbe interpolar valores en el SQL.

## Inscripción a la hackathon
El registro de estudiantes para la hackathon vive en este API con identidad propia (tablas `usuarios`, `hackathones`, `inscripciones` y `tokens_usuario`, separadas de `users` de polipuntos). Documentación en `docs/hackathon-inscripciones.md` y `docs/adr/0011-registro-de-hackathon-en-apex-api.md`.

```
pnpm migrate:latest
pnpm seed:hackathon
```

El seed imprime el identificador del evento; ese valor va en `NEXT_PUBLIC_EVENTO_ID` de `apex-web`. Variables nuevas: `APEX_WEB_BASE_URL` (para el enlace del correo de verificación), `EMAIL_VERIFICATION_TTL_HOURS`, `EMAIL_VERIFICATION_COOLDOWN_SECONDS` y las `HACKATHON_*`. El origen de `apex-web` debe estar en `CORS_ORIGINS` en producción.

## Modo offline
- `GET /polipoints/roster`: estudiantes inscritos del profesor y sus asignaturas activas, para que el dispositivo los guarde y pueda identificar un QR sin conexión.
- `POST /polipoints/awards`: `points` es un entero distinto de cero entre `-MAX_POINTS_PER_AWARD` y `MAX_POINTS_PER_AWARD`; un valor negativo descuenta polipuntos y los totales (por asignatura y global) pueden quedar por debajo de cero.
- `POST /polipoints/awards/batch`: sincroniza asignaciones encoladas (`qrToken` o `studentId` para asignaciones manuales, `offeringId`, `points`, `idempotencyKey`, `occurredAt`). Responde un resultado por ítem (`created`, `duplicate`, `rejected`). La firma y versión del QR se validan aquí. Cada asignación guarda su origen en `source` (`qr` o `manual`). Se rechazan fechas futuras y anteriores a `OFFLINE_AWARD_MAX_AGE_DAYS` (7 por defecto).

## Super admin inicial
`pnpm seed:super-admin` crea (o actualiza) al super admin con `SUPER_ADMIN_CEDULA`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`. El correo es obligatorio y debe ser institucional (`ALLOWED_EMAIL_DOMAIN`), porque lo necesita para recuperar su contraseña. El seed es idempotente: si el usuario ya existe, solo actualiza el correo.

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

### Plantillas de correo
`src/lib/mail-layout.ts` renderiza todos los correos con el mismo diseño de la web (fondo oscuro, tarjeta, botón verde, wordmark APEX) usando tablas y estilos en línea para que funcione en Gmail y Outlook, más una versión en texto plano. El símbolo viaja como adjunto embebido (`cid:`), desde `assets/mail/apex-symbol.png`, para no depender de imágenes remotas que los clientes bloquean. Los textos viven en `src/lib/mail-templates.ts`. Hoy se envían dos: el enlace de restablecimiento y el aviso de contraseña cambiada.

## Desarrollo en red local
Con `NODE_ENV=development` el CORS acepta, además de `CORS_ORIGINS`, cualquier origen de `localhost`, de IPs privadas y de `*.local`, para probar desde el celular sin configurar nada. En `production` solo vale `CORS_ORIGINS`, y la cookie de refresh es `Secure`.

## Puerto
El API escucha en `PORT` (4000 por defecto; el 5000 queda libre para otros proyectos). El frontend lo toma de `NEXT_PUBLIC_API_URL`.

## Calidad antes de cada commit
Husky ejecuta `.husky/pre-commit`: `lint` (sin advertencias), `typecheck` y `build`. Si falla alguno, el commit se cancela. Los tests no se incluyen en el hook porque requieren la base de datos en Docker; correlos con `pnpm test`.

## Pendientes
- **CI/CD con GitHub Actions** (aún no): workflow que corra lint, typecheck, build y tests (con Postgres como servicio) en cada push y pull request, y despliegue a producción.
- Registro de eventos de seguridad (IP, dispositivo) y aviso de contraseña cambiada con esos datos.
- Sesiones activas por dispositivo y verificación adicional (2FA, passkeys).
- Documentación OpenAPI.
