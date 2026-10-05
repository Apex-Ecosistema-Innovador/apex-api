import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('polipoint_awards', (table) => {
    table.timestamp('occurred_at', { useTz: true }).nullable();
  });
  await knex.raw('UPDATE polipoint_awards SET occurred_at = created_at');
  await knex.raw('ALTER TABLE polipoint_awards ALTER COLUMN occurred_at SET NOT NULL');
  await knex.raw('ALTER TABLE polipoint_awards ALTER COLUMN occurred_at SET DEFAULT now()');
  await knex.schema.alterTable('polipoint_awards', (table) => {
    table.index(['teacher_id', 'occurred_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('polipoint_awards', (table) => {
    table.dropIndex(['teacher_id', 'occurred_at']);
    table.dropColumn('occurred_at');
  });
}
