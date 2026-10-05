import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('cedula', 20).notNullable().unique();
    table.string('full_name', 150).notNullable();
    table.string('full_name_search', 150).notNullable();
    table.string('email', 254).nullable().unique();
    table.string('password_hash').notNullable();
    table
      .enu('role', ['student', 'teacher', 'admin', 'super_admin'], { useNative: true, enumName: 'user_role' })
      .notNullable();
    table
      .enu('status', ['active', 'pending_approval', 'disabled'], { useNative: true, enumName: 'user_status' })
      .notNullable()
      .defaultTo('active');
    table.integer('qr_token_version').notNullable().defaultTo(1);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX users_full_name_search_trgm ON users USING gin (full_name_search gin_trgm_ops)');
  await knex.raw('CREATE INDEX users_cedula_trgm ON users USING gin (cedula gin_trgm_ops)');

  await knex.schema.createTable('offerings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('teacher_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('course_code', 30).notNullable();
    table.string('course_name', 150).notNullable();
    table.string('term', 20).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['teacher_id', 'course_code', 'term']);
    table.index(['teacher_id']);
  });

  await knex.schema.createTable('enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('offering_id').notNullable().references('id').inTable('offerings').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['student_id', 'offering_id']);
    table.index(['offering_id']);
  });

  await knex.schema.createTable('polipoint_awards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('offering_id').notNullable().references('id').inTable('offerings').onDelete('RESTRICT');
    table.uuid('teacher_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('points').notNullable();
    table.string('reason', 255).nullable();
    table.string('idempotency_key', 100).notNullable().unique();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('source', 10).notNullable().defaultTo('qr');
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.uuid('revoked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('revoke_reason', 255).nullable();
    table.index(['student_id']);
    table.index(['offering_id', 'student_id']);
    table.index(['teacher_id', 'occurred_at']);
  });
  await knex.raw('ALTER TABLE polipoint_awards ADD CONSTRAINT polipoint_awards_points_positive CHECK (points > 0)');
  await knex.raw(
    "ALTER TABLE polipoint_awards ADD CONSTRAINT polipoint_awards_source_valid CHECK (source IN ('qr', 'manual'))",
  );

  await knex.schema.createTable('teacher_invites', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code', 40).notNullable().unique();
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('used_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('password_reset_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id', 'created_at']);
  });

  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('family_id').notNullable();
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['family_id']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('teacher_invites');
  await knex.schema.dropTableIfExists('polipoint_awards');
  await knex.schema.dropTableIfExists('enrollments');
  await knex.schema.dropTableIfExists('offerings');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_status');
  await knex.raw('DROP TYPE IF EXISTS user_role');
}
