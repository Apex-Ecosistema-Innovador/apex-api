# Guía de despliegue

Tres piezas: **Postgres administrado**, **apex-api** (Node 24, proceso persistente) y las webs **polipuntos-web** y **apex-web** en Vercel (un proyecto por repositorio). El API no va en Vercel: es Express con un pool de conexiones y necesita un proceso que siga vivo (Render, Railway o Fly).

Orden: base de datos, correo, API, webs, ajustar CORS y verificar.

## 1. Base de datos
1. Crea un Postgres 16 (Supabase, Neon o el de Railway).
2. Copia la cadena de conexión **directa** (puerto 5432, no el pooler en modo transacción) para `DATABASE_URL`.
3. Si el proveedor exige SSL: `DB_SSL=true`. Si falla la verificación del certificado, usa `DB_SSL_CA` con el certificado del proveedor; `DB_SSL_REJECT_UNAUTHORIZED=false` solo como último recurso.

## 2. Correo (obligatorio en producción)
Con `NODE_ENV=production` el API no arranca sin `SMTP_HOST`. Se usa para recuperar contraseña y verificar la inscripción a la hackathon. Resend, Brevo o SendGrid sirven; para una demo corta, una cuenta con contraseña de aplicación. Define `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`. Verifica el dominio remitente (SPF/DKIM) o los correos caerán en spam.

## 3. API
Servicio web con Node 24 (`NODE_VERSION=24`), Debian/Ubuntu (no hace falta Docker). `corepack enable` instala pnpm según `packageManager`.

| Paso | Comando |
| --- | --- |
| Build | `pnpm install --frozen-lockfile && pnpm build` |
| Migraciones (pre-deploy) | `pnpm migrate:prod` |
| Start | `pnpm start` |
| Health check | `GET /health` |

Variables (ver `.env.example`):

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL`, `DB_SSL` | del paso 1 |
| `JWT_ACCESS_SECRET`, `QR_SECRET` | distintos, 32 caracteres o más (`openssl rand -base64 48`). Cambiar `QR_SECRET` invalida todos los QR |
| `CORS_ORIGINS` | orígenes exactos de las webs, separados por coma, sin `/` final: `https://polipuntos.vercel.app,https://apex.vercel.app` |
| `WEB_BASE_URL` / `APEX_WEB_BASE_URL` | URL pública de polipuntos-web y de apex-web (van en los enlaces de los correos) |
| `COOKIE_SAME_SITE` | `lax` si web y API comparten dominio raíz (`app.midominio.com` y `api.midominio.com`); `none` si están en dominios distintos (`vercel.app` y `onrender.com`) |
| `ALLOWED_EMAIL_DOMAIN` | `elpoli.edu.co` |
| `CURRENT_TERM` | opcional, p. ej. `2026-2`; si no, se calcula por fecha |
| `SMTP_*`, `MAIL_FROM` | del paso 2 |

Datos iniciales, una sola vez (con las variables `SUPER_ADMIN_*` definidas; bórralas después):
```
pnpm seed:super-admin:prod
pnpm seed:hackathon:prod
```
El segundo imprime el id del evento: lo necesita apex-web.

Notas:
- Las migraciones corren desde `dist` con la CLI de knex; hay que hacer `rm -rf dist` antes de compilar si reutilizas la carpeta (un build viejo dejaba una migración fantasma).
- `pdf-parse` trae una dependencia nativa con binarios para Linux x64 y arm64; usa una imagen Debian, no una muy mínima.
- El API ya confía en 1 proxy (`trust proxy`), así que el rate limiting ve la IP real detrás de Render/Railway.

## 4. polipuntos-web (Vercel)
Importa el repositorio; Vercel detecta Next.js y pnpm. Node 24 en Settings > General. Si no reconoce la versión de pnpm, añade `ENABLE_EXPERIMENTAL_COREPACK=1`.

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<tu-api>/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | URL `https://` de la web (activa `upgrade-insecure-requests` en la CSP) |

No definas `DISABLE_SECURITY_HEADERS` ni `ALLOWED_DEV_ORIGINS`. Las `NEXT_PUBLIC_*` se incrustan al compilar: si las cambias, vuelve a desplegar. La CSP toma el origen del API de `NEXT_PUBLIC_API_URL`.

## 5. apex-web (Vercel)
Mismo procedimiento. Variables: `NEXT_PUBLIC_API_URL` (la misma del API) y `NEXT_PUBLIC_EVENTO_ID` (id que imprimió el seed de la hackathon).

## 6. Cerrar el círculo
1. Con las URLs finales de Vercel, actualiza `CORS_ORIGINS`, `WEB_BASE_URL` y `APEX_WEB_BASE_URL` en el API y reinícialo.
2. Las URLs de preview de Vercel cambian en cada despliegue y no están en `CORS_ORIGINS`: solo funciona el dominio de producción.
3. Si usas `COOKIE_SAME_SITE=none`, Safari y algunos navegadores bloquean cookies de terceros: la sesión se perdería a los 15 minutos (`ACCESS_TOKEN_TTL`). Para una demo sube `ACCESS_TOKEN_TTL=8h`, o mejor usa dominios propios bajo el mismo dominio raíz y `lax`.

## 7. Verificación
- `GET https://<api>/health` responde `{"status":"ok"}`.
- Registro de estudiante, cierre y apertura de sesión, y que siga activa pasados unos minutos.
- Recuperar contraseña: llega el correo y el enlace abre la web correcta.
- Profesor: invitación creada por el super admin, registro y creación de una asignatura del periodo vigente.
- Escáner desde el celular (HTTPS): abre la cámara y lee un QR.
- Estudiante: cargar el PDF del horario, ranking y puntos negativos.
- Hackathon: inscripción en apex-web, correo de verificación y enlace de un solo uso.
- Consola del navegador sin violaciones de CSP.

## 8. Operación
- Cada despliegue con migraciones nuevas ejecuta `pnpm migrate:prod` antes de arrancar.
- El periodo vigente cambia solo el 1 de enero y el 1 de julio (hora de Bogotá), cuando terminan los semestres de diciembre y junio. Si quieres que cambie el día que empiezan las clases, fija `CURRENT_TERM` a mano. Hasta que el portal publique horarios del periodo nuevo, los estudiantes no podrán cargarlo.
- Haz respaldos de la base de datos (los proveedores administrados los ofrecen) y rota los secretos si se filtran.
