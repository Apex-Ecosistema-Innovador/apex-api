# apex-api

Backend centralizado del ecosistema APEX. Primer consumidor: `polipuntos-web`.

## Requisitos
Node 24+, Docker (Postgres local) o un proyecto Supabase (usar el connection pooler en `DATABASE_URL`).

## Puesta en marcha
```
cp .env.example .env
npm install
npm run db:up
npm run migrate:latest
npm run seed:super-admin
npm run dev
```

## Scripts
`dev`, `build`, `start`, `typecheck`, `lint`, `test`, `migrate:*`, `seed:super-admin`.

## Arquitectura
`routers → controllers → services → repositories` con validación Zod en controllers, errores `CustomError` centralizados y respuestas `{ message, payload, page, limit, total }`. API bajo `/api/v1`.

## Roles
`student`, `teacher`, `admin`, `super_admin`. Los profesores sin código de invitación quedan en `pending_approval` hasta que un admin los apruebe. Solo `super_admin` crea administradores.

## Polipuntos
Cada asignación pertenece a una asignatura (offering) de un profesor; los totales por asignatura y global se calculan sobre asignaciones no revertidas. Límite por asignación: `MAX_POINTS_PER_AWARD` (1000 por defecto).
