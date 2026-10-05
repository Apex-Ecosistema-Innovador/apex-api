import request from 'supertest';
import server from '../server';
import database from '../lib/database';
import { hashPassword } from '../lib/hash';
import { normalizeName } from '../lib/normalize';
import { hashRefreshToken } from '../lib/refresh-token';
import { resetDatabase } from './reset-database';

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
    const insert = async (cedula: string, role: string) =>
      (
        await database('users')
          .insert({
            cedula,
            full_name: `Usuario ${cedula}`,
            full_name_search: normalizeName(`Usuario ${cedula}`),
            password_hash: await hashPassword('password123'),
            role,
            status: 'active',
          })
          .returning('id')
      )[0].id as string;

    await insert('1000000002', 'super_admin');
    teacherId = await insert('5000000009', 'teacher');
    await insert('6000000009', 'student');
    adminAccess = (await login('1000000002')).access;
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('stores only a hash and issues an opaque token', async () => {
    const { token } = await login('6000000009');
    expect(token.split('.')).toHaveLength(1);
    const row = await database('refresh_tokens')
      .where({ token_hash: hashRefreshToken(token) })
      .first();
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

    const rows = await database('refresh_tokens').whereIn('token_hash', [first.token, second].map(hashRefreshToken));
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

    await database('refresh_tokens')
      .where({ token_hash: hashRefreshToken(token) })
      .update({ used_at: new Date(Date.now() - 60_000) });

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
    await database('refresh_tokens')
      .where({ token_hash: hashRefreshToken(token) })
      .update({ expires_at: new Date(Date.now() - 1000) });

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
