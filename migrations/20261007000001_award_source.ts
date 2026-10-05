import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('polipoint_awards', (table) => {
    table.string('source', 10).notNullable().defaultTo('qr');
  });
  await knex.raw(
    "ALTER TABLE polipoint_awards ADD CONSTRAINT polipoint_awards_source_valid CHECK (source IN ('qr', 'manual'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE polipoint_awards DROP CONSTRAINT IF EXISTS polipoint_awards_source_valid');
  await knex.schema.alterTable('polipoint_awards', (table) => {
    table.dropColumn('source');
  });
}
