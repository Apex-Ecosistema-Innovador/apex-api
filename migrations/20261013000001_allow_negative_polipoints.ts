import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE polipoint_awards DROP CONSTRAINT polipoint_awards_points_positive');
  await knex.raw('ALTER TABLE polipoint_awards ADD CONSTRAINT polipoint_awards_points_nonzero CHECK (points <> 0)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE polipoint_awards DROP CONSTRAINT polipoint_awards_points_nonzero');
  await knex.raw('ALTER TABLE polipoint_awards ADD CONSTRAINT polipoint_awards_points_positive CHECK (points > 0)');
}
