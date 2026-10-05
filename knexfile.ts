import type { Knex } from 'knex';
import { buildConnection } from './src/lib/connection';

const config: Knex.Config = {
  client: 'pg',
  connection: buildConnection(),
  migrations: { directory: './migrations', extension: 'ts' },
  seeds: { directory: './seeds', extension: 'ts' },
};

export default config;
