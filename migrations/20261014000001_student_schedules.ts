import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('student_schedules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('term', 20).notNullable();
    table.timestamp('uploaded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['student_id', 'term']);
  });

  await knex.schema.createTable('student_schedule_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('schedule_id').notNullable().references('id').inTable('student_schedules').onDelete('CASCADE');
    table.string('course_code', 30).notNullable();
    table.string('course_name', 150).notNullable();
    table.unique(['schedule_id', 'course_code']);
  });

  await knex.raw('CREATE INDEX offerings_course_code_term ON offerings (course_code, term)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS offerings_course_code_term');
  await knex.schema.dropTableIfExists('student_schedule_items');
  await knex.schema.dropTableIfExists('student_schedules');
}
