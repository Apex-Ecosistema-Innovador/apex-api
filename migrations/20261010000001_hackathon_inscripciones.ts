import type { Knex } from 'knex';

const ROLES = ['ADMIN_PLATAFORMA', 'ORGANIZADOR', 'PARTICIPANTE', 'JURADO', 'PUBLICO'];
const FASES = [
  'BORRADOR',
  'INSCRIPCIONES',
  'EQUIPOS',
  'DESARROLLO',
  'ENTREGAS_CERRADAS',
  'PRESELECCION',
  'FINAL',
  'RESULTADOS',
  'ARCHIVADO',
  'CANCELADO',
];
const ESTADOS_INSCRIPCION = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'EN_LISTA_ESPERA'];
const ETAPAS = ['PRESELECCION', 'FINAL'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`CREATE TYPE rol AS ENUM (${ROLES.map((value) => `'${value}'`).join(', ')})`);
  await knex.schema.raw(`CREATE TYPE fase AS ENUM (${FASES.map((value) => `'${value}'`).join(', ')})`);
  await knex.schema.raw(
    `CREATE TYPE estado_inscripcion AS ENUM (${ESTADOS_INSCRIPCION.map((value) => `'${value}'`).join(', ')})`,
  );
  await knex.schema.raw(`CREATE TYPE etapa AS ENUM (${ETAPAS.map((value) => `'${value}'`).join(', ')})`);
  await knex.schema.raw(`CREATE TYPE estado_usuario AS ENUM ('ACTIVO', 'SUSPENDIDO')`);
  await knex.schema.raw(`CREATE TYPE tipo_token_usuario AS ENUM ('VERIFICACION_CORREO', 'RECUPERACION_CONTRASENA')`);

  await knex.schema.createTable('usuarios', (table) => {
    table.uuid('id').primary();
    table.string('correo', 254).notNullable();
    table.string('hash_contrasena').notNullable();
    table.string('nombre', 150).notNullable();
    table.string('github', 39).nullable();
    table.string('linkedin', 255).nullable();
    table.string('portafolio', 255).nullable();
    table.specificType('estado', 'estado_usuario').notNullable().defaultTo('ACTIVO');
    table.timestamp('correo_verificado_en', { useTz: true }).nullable();
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (lower(correo))');
  await knex.schema.raw(
    'ALTER TABLE usuarios ADD CONSTRAINT usuarios_correo_en_minusculas CHECK (correo = lower(correo))',
  );

  await knex.schema.createTable('hackathones', (table) => {
    table.uuid('id').primary();
    table.string('nombre', 150).notNullable();
    table.text('descripcion').notNullable().defaultTo('');
    table.string('modalidad', 30).notNullable();
    table.string('lugar', 200).notNullable().defaultTo('');
    table.string('zona_horaria', 60).notNullable().defaultTo('America/Bogota');
    table.integer('cupo_maximo').nullable();
    table.integer('equipo_min').notNullable();
    table.integer('equipo_max').notNullable();
    table.specificType('fase_actual', 'fase').notNullable().defaultTo('BORRADOR');
    table.string('version_reglamento', 20).notNullable();
    table.integer('finalistas_por_categoria').notNullable().defaultTo(8);
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'ALTER TABLE hackathones ADD CONSTRAINT hackathones_equipo_valido CHECK (equipo_min >= 1 AND equipo_max >= equipo_min)',
  );

  await knex.schema.createTable('inscripciones', (table) => {
    table.uuid('id').primary();
    table.uuid('usuario_id').notNullable().references('id').inTable('usuarios').onDelete('RESTRICT');
    table.uuid('hackathon_id').notNullable().references('id').inTable('hackathones').onDelete('RESTRICT');
    table.specificType('estado', 'estado_inscripcion').notNullable().defaultTo('PENDIENTE');
    table.string('institucion', 150).notNullable();
    table.string('programa', 150).notNullable();
    table.smallint('semestre').notNullable();
    table.specificType('tecnologias', 'text[]').nullable();
    table.string('nivel_experiencia', 30).nullable();
    table.string('reglamento_version', 20).notNullable();
    table.string('datos_version', 20).notNullable();
    table.timestamp('aceptado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.boolean('consiente_publicacion_imagen').notNullable().defaultTo(false);
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['usuario_id', 'hackathon_id']);
    table.index(['hackathon_id', 'estado']);
  });
  await knex.schema.raw(
    'ALTER TABLE inscripciones ADD CONSTRAINT inscripciones_semestre_valido CHECK (semestre BETWEEN 1 AND 12)',
  );

  await knex.schema.createTable('tokens_usuario', (table) => {
    table.uuid('id').primary();
    table.uuid('usuario_id').notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
    table.specificType('tipo', 'tipo_token_usuario').notNullable();
    table.string('hash_token', 64).notNullable().unique();
    table.timestamp('expira_en', { useTz: true }).notNullable();
    table.timestamp('usado_en', { useTz: true }).nullable();
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['usuario_id', 'tipo']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tokens_usuario');
  await knex.schema.dropTableIfExists('inscripciones');
  await knex.schema.dropTableIfExists('hackathones');
  await knex.schema.dropTableIfExists('usuarios');
  await knex.schema.raw('DROP TYPE IF EXISTS tipo_token_usuario');
  await knex.schema.raw('DROP TYPE IF EXISTS estado_usuario');
  await knex.schema.raw('DROP TYPE IF EXISTS etapa');
  await knex.schema.raw('DROP TYPE IF EXISTS estado_inscripcion');
  await knex.schema.raw('DROP TYPE IF EXISTS fase');
  await knex.schema.raw('DROP TYPE IF EXISTS rol');
}
