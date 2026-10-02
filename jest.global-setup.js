require('ts-node/register/transpile-only');
const knex = require('knex');

module.exports = async () => {
  const url = process.env.TEST_DATABASE_URL || 'postgres://apex:apex@localhost:5433/apex_test';
  const db = knex({ client: 'pg', connection: url, migrations: { directory: './migrations', extension: 'ts' } });
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.destroy();
};
