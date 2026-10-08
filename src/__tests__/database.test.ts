import Database from '../lib/database';
import { buildPoolConfig } from '../lib/connection';
import { insertUser, resetDatabase } from './reset-database';

afterAll(async () => {
  await Database.close();
});

describe('database layer', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('commits a transaction', async () => {
    await Database.transaction(async (transaction) => {
      await transaction.execute(
        `INSERT INTO users (cedula, full_name, full_name_search, password_hash, role, status)
         VALUES ('7000000001', 'Ana', 'ana', 'hash', 'student', 'active')`,
      );
    });
    const rows = await Database.query('SELECT id FROM users WHERE cedula = $1', ['7000000001']);
    expect(rows).toHaveLength(1);
  });

  it('rolls back a transaction when the callback throws', async () => {
    await expect(
      Database.transaction(async (transaction) => {
        await transaction.execute(
          `INSERT INTO users (cedula, full_name, full_name_search, password_hash, role, status)
           VALUES ('7000000002', 'Beto', 'beto', 'hash', 'student', 'active')`,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await Database.query('SELECT id FROM users WHERE cedula = $1', ['7000000002']);
    expect(rows).toHaveLength(0);
  });

  it('keeps the pg error code and tags the query id', async () => {
    await insertUser('7000000003', 'Carla', 'student');
    const duplicate = insertUser('7000000003', 'Carla', 'student');
    await expect(duplicate).rejects.toMatchObject({ code: '23505' });
    await expect(Database.query('SELECT * FROM missing_table', [], { queryId: 'test.missing' })).rejects.toMatchObject({
      queryId: 'test.missing',
    });
  });

  it('treats hostile input as data', async () => {
    const hostile = "x'; DROP TABLE users; --";
    const rows = await Database.query('SELECT id FROM users WHERE cedula = $1', [hostile]);
    expect(rows).toEqual([]);
    expect(await Database.query('SELECT count(*)::int AS total FROM users')).toEqual([{ total: 0 }]);
  });
});

describe('pool configuration', () => {
  const url = 'postgres://user:pass@host:5432/db';

  it('defaults to ten connections', () => {
    expect(buildPoolConfig({ DATABASE_URL: url })).toMatchObject({ max: 10 });
  });

  it('reads the pool size from env', () => {
    expect(buildPoolConfig({ DATABASE_URL: url, DB_POOL_MAX: '4' })).toMatchObject({ max: 4 });
  });

  it('rejects an invalid pool size', () => {
    expect(() => buildPoolConfig({ DATABASE_URL: url, DB_POOL_MAX: '0' })).toThrow();
  });
});
