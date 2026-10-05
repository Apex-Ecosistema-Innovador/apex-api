require('ts-node/register/transpile-only');
const knex = require('knex');

module.exports = async () => {
  const url = process.env.TEST_DATABASE_URL || 'postgres://apex:apex@localhost:5433/apex_test';
  const db = knex({ client: 'pg', connection: url, migrations: { directory: './migrations', extension: 'ts' } });
  await db.raw('DROP SCHEMA public CASCADE');
  await db.raw('CREATE SCHEMA public');
  await db.migrate.latest();
  await db.destroy();
};
