# ADR-0011: Registro de la hackathon sobre apex-api y apex-web

## Estado
Aceptada

## Contexto
La Especificación v1.0 y el alcance de la Fase A describen una plataforma propia (monorepo con NestJS, Drizzle, pg-boss y React con Vite) que todavía no existe. Se necesita abrir ya el registro de estudiantes para la hackathon. El sitio público es `apex-web` (Next.js) y el backend central del ecosistema es `apex-api` (Express, Postgres, SQL parametrizado).

## Decisión
- El registro (RF-ID-01, RF-IN-01, RF-IN-02, RF-EV-04, RNF-DAT-01, RNF-DAT-02, RNF-DAT-06) se implementa en `apex-api` y el formulario vive en `apex-web`.
- Los participantes tienen identidad propia, separada de `users` (polipuntos): tablas `usuarios`, `hackathones`, `inscripciones` y `tokens_usuario`, con los nombres de la v1.0 §10.2. No se pide cédula (v1.0 §8.2).
- Las tablas e enums de los módulos aún no construidos (`membresias`, `sesiones`, `equipos`…) se crean con su módulo. Los enums `rol`, `fase`, `estado_inscripcion` y `etapa` ya existen completos, como exige la Fase A §5.2.
- Se crean la cuenta y la inscripción en una sola operación: cuenta + inscripción PENDIENTE + token de verificación, dentro de una transacción que bloquea la fila del evento con `FOR SHARE` para validar la fase.

## Alternativas consideradas
- Repo nuevo con el stack completo de la v1.0: más fiel al documento, pero bloquea el registro hasta construir la plataforma.
- Reutilizar `users` de polipuntos: obliga a pedir cédula y a que todos tengan correo `@elpoli.edu.co`, y rompe la minimización de datos.

## Consecuencias
- Desvíos respecto a la v1.0 que habrá que revisar al migrar a la plataforma: Express y Knex/SQL en vez de NestJS y Drizzle (D-02, D-13); envío de correo directo tras el commit en vez de pg-boss (D-14, RF-NO-04); sin sesiones todavía (D-04); esquemas Zod duplicados entre API y web en vez de `packages/contratos`; sin comentarios en el código por norma del proyecto (la v1.0 §8.3 pide comentar el porqué: ese contenido va en `docs/`).
- Se añadió `usuarios.correo_verificado_en` y la tabla `tokens_usuario`, que la v1.0 implica en RF-ID-01 y RF-ID-03 pero no lista.
- La versión de la autorización de datos vive en `src/constants/hackathon.ts`; la del reglamento, en `hackathones.version_reglamento`.
