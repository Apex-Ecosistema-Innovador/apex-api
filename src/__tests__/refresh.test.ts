import request from 'supertest';
import server from '../server';
import Database from '../lib/database';
import { hashRefreshToken } from '../lib/refresh-token';
import { insertUser, resetDatabase } from './reset-database';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const refreshCookie = (res: request.Response) => {
  const header = (res.headers['set-cookie'] as unknown as string[]).find((cookie) =>
    cookie.startsWith('apex_refresh='),
  )!;
  return header.split(';')[0].split('=')[1];
};

const withCookie = (token: string) => ({ Cookie: `apex_refresh=${token}` });

const login = async (cedula: string) => {
  const res = await api.post(`${base}/auth/login`).send({ cedula, password: 'password123' });
  return { token: refreshCookie(res), access: res.body.payload.accessToken as string, res };
};

const refresh = (token: string) => api.post(`${base}/auth/refresh`).set(withCookie(token));

describe('refresh token rotation', () => {
  let adminAccess: string;
  let teacherId: string;

  beforeAll(async () => {
    await resetDatabase();
    await insertUser('1000000002', 'Usuario 1000000002', 'super_admin');
    teacherId = await insertUser('5000000009', 'Usuario 5000000009', 'teacher');
    await insertUser('6000000009', 'Usuario 6000000009', 'student');
    adminAccess = (await login('1000000002')).access;
  });

  afterAll(async () => {
    await Database.close();
  });

  it('stores only a hash and issues an opaque token', async () => {
    const { token } = await login('6000000009');
    expect(token.split('.')).toHaveLength(1);
    const [row] = await Database.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [hashRefreshToken(token)]);
    expect(row).toBeDefined();
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('rotates the token on every refresh and keeps the family', async () => {
    const first = await login('6000000009');
    const res = await refresh(first.token);
    const second = refreshCookie(res);

    expect(res.status).toBe(200);
    expect(second).not.toBe(first.token);
    expect((await refresh(second)).status).toBe(200);

    const rows = await Database.query<{ family_id: string }>(
      'SELECT family_id FROM refresh_tokens WHERE token_hash = ANY($1::text[])',
      [[first.token, second].map(hashRefreshToken)],
    );
    expect(new Set(rows.map((row) => row.family_id)).size).toBe(1);
  });

  it('tolerates a replay inside the grace window', async () => {
    const { token } = await login('6000000009');
    expect((await refresh(token)).status).toBe(200);
    expect((await refresh(token)).status).toBe(200);
  });

  it('revokes the whole family when a used token is replayed after the grace window', async () => {
    const { token } = await login('6000000009');
    const rotated = refreshCookie(await refresh(token));

    await Database.execute('UPDATE refresh_tokens SET used_at = $2 WHERE token_hash = $1', [
      hashRefreshToken(token),
      new Date(Date.now() - 60_000),
    ]);

    expect((await refresh(token)).status).toBe(401);
    expect((await refresh(rotated)).status).toBe(401);
  });

  it('revokes the session on logout', async () => {
    const { token } = await login('6000000009');
    const next = refreshCookie(await refresh(token));

    const out = await api.post(`${base}/auth/logout`).set(withCookie(next));
    expect(out.status).toBe(200);
    expect((await refresh(next)).status).toBe(401);
    expect((await refresh(token)).status).toBe(401);
  });

  it('rejects expired, unknown and missing tokens', async () => {
    const { token } = await login('6000000009');
    await Database.execute('UPDATE refresh_tokens SET expires_at = $2 WHERE token_hash = $1', [
      hashRefreshToken(token),
      new Date(Date.now() - 1000),
    ]);

    expect((await refresh(token)).status).toBe(401);
    expect((await refresh('unknown-token')).status).toBe(401);
    expect((await api.post(`${base}/auth/refresh`)).status).toBe(401);
  });

  it('keeps independent sessions apart', async () => {
    const phone = await login('6000000009');
    const laptop = await login('6000000009');
    await api.post(`${base}/auth/logout`).set(withCookie(phone.token));

    expect((await refresh(laptop.token)).status).toBe(200);
  });

  it('drops every session when a teacher is disabled', async () => {
    const { token } = await login('5000000009');
    const disabled = await api.patch(`${base}/admin/teachers/${teacherId}/disable`).set(bearer(adminAccess));
    expect(disabled.status).toBe(200);

    expect((await refresh(token)).status).toBe(401);
  });
});
