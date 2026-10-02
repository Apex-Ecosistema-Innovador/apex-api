import knex from 'knex';
import { env } from '../config/env';

const database = knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 0, max: 10 },
});

export default database;
