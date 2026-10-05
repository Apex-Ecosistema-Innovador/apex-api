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
- `POST /polipoints/awards/batch`: sincroniza asignaciones encoladas (`qrToken`, `offeringId`, `points`, `idempotencyKey`, `occurredAt`). Responde un resultado por ítem (`created`, `duplicate`, `rejected`). La firma y versión del QR se validan aquí. Se rechazan fechas futuras y anteriores a `OFFLINE_AWARD_MAX_AGE_DAYS` (7 por defecto).
