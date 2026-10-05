import knex from 'knex';
import { buildConnection } from './connection';

const database = knex({
  client: 'pg',
  connection: buildConnection(),
  pool: { min: 0, max: 10 },
});

export default database;
