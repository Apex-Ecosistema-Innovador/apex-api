# Guía de despliegue

Tres piezas: **Postgres administrado**, **apex-api** (Node 24, proceso persistente) y las webs **polipuntos-web** y **apex-web** en Vercel (un proyecto por repositorio). El API no va en Vercel: es Express con un pool de conexiones y necesita un proceso que siga vivo (Render, Railway o Fly).

Orden: base de datos, correo, API, webs, ajustar CORS y verificar.

## 1. Base de datos
1. Crea un Postgres 16 (Supabase, Neon o el de Railway).
2. Si usas **Supabase**: el host directo `db.<ref>.supabase.co` solo tiene IPv6 y la mayoría de hosts (y muchas redes) no salen por IPv6. Usa el **Session pooler** (Connect > Session pooler), con el formato `postgresql://postgres.<ref>:<clave>@aws-0-<región>.pooler.supabase.com:5432/postgres`. Si la clave tiene caracteres especiales, codifícalos en la URL (`)` es `%29`).
3. SSL: `DB_SSL=true` y `DB_SSL_CA` con el contenido del certificado raíz de Supabase (Database settings > SSL Configuration > Download certificate). Sin ese certificado Node rechaza la conexión por «self-signed certificate in certificate chain».
4. Supabase expone las tablas del esquema `public` por su API REST con la clave pública. La migración `20261015000001_enable_row_level_security` activa RLS en todas las tablas existentes y, sin políticas, esa clave no puede leer ni escribir nada; el API se conecta como `postgres`, que ignora RLS. Si agregas tablas nuevas, activa RLS en su migración. No uses las claves `NEXT_PUBLIC_SUPABASE_*`: el API es el dueño de la autenticación.

## 2. Correo (obligatorio en producción)
Con `NODE_ENV=production` el API no arranca sin `SMTP_HOST`. Se usa para recuperar contraseña y verificar la inscripción a la hackathon. Resend, Brevo o SendGrid sirven; para una demo corta, una cuenta con contraseña de aplicación. Define `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`. Verifica el dominio remitente (SPF/DKIM) o los correos caerán en spam.

## 3. API en Vercel
El repo trae `vercel.json` y `api/index.js`: Vercel compila con `pnpm build` y expone la app de Express como una función (todas las rutas se reescriben a ella). Crea un proyecto nuevo con el repo `apex-api` (Framework Preset: Other), Node 24 y las variables de `deploy-env/apex-api.vercel.env`.

- **Conexión a la base:** en serverless cada instancia abre su propio pool, así que usa el **Transaction pooler** de Supabase (puerto 6543) y `DB_POOL_MAX=1`. Las migraciones y los seeds no corren en Vercel: ejecútalos desde tu máquina con el Session pooler (puerto 5432), como en la sección 1.
- **Lectura de PDF:** `vercel.json` fuerza a incluir `pdf-parse`, `@napi-rs/canvas` y `pdfjs-dist` en la función, porque el análisis estático de Vercel no los detecta. Probé el paquete resultante en local, pero no en Vercel.
- **Límites:** región `iad1` (cerca de Supabase us-east-1), 30 s por petición, cuerpo de hasta 4,5 MB (el horario permite 2 MB). El rate limiting es por instancia (memoria), así que protege menos que en un servidor único.
- **Correos:** la función se congela al responder; un correo que se envíe después de la respuesta puede perderse. Con SMTP real conviene esperar el envío antes de responder.

## 3b. API en un servidor persistente (alternativa: Render, Railway)
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
| `NEXT_PUBLIC_API_URL` | `/api/v1` (mismo origen; ver abajo) |
| `API_PROXY_TARGET` | `https://<tu-api>` (solo servidor) |
| `NEXT_PUBLIC_SITE_URL` | URL `https://` de la web (activa `upgrade-insecure-requests` en la CSP) |

Con ese par de variables Vercel reenvía `/api/v1/*` al API y el navegador solo habla con el dominio de la web: la cookie de refresco es de primera parte y funciona en Safari. Por eso el API usa `COOKIE_SAME_SITE=lax`. No definas `DISABLE_SECURITY_HEADERS` ni `ALLOWED_DEV_ORIGINS`. Las `NEXT_PUBLIC_*` se incrustan al compilar: si las cambias, vuelve a desplegar. La CSP toma el origen del API de `NEXT_PUBLIC_API_URL`.

## 5. apex-web (Vercel)
Mismo procedimiento. Variables: `NEXT_PUBLIC_API_URL` (la misma del API) y `NEXT_PUBLIC_EVENTO_ID` (id que imprimió el seed de la hackathon).

## 6. Cerrar el círculo
1. Con las URLs finales de Vercel, actualiza `CORS_ORIGINS`, `WEB_BASE_URL` y `APEX_WEB_BASE_URL` en el API y reinícialo.
2. Las URLs de preview de Vercel cambian en cada despliegue y no están en `CORS_ORIGINS`: solo funciona el dominio de producción.
3. No uses `COOKIE_SAME_SITE=none` con web y API en `vercel.app`: Safari bloquea esa cookie de terceros y la sesión se pierde al recargar. Usa el rewrite de polipuntos-web (sección 4) o dominios propios bajo el mismo dominio raíz, con `lax`. apex-web no usa sesión y sigue llamando directo al API (por eso `CORS_ORIGINS` debe incluir su dominio).

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
