import request from 'supertest';
import server from '../server';
import database from '../lib/database';
import { mailer, MemoryTransport } from '../lib/mailer';
import { resetDatabase } from './reset-database';

const api = request(server.app);
const base = '/api/v1';
const outbox = (mailer as MemoryTransport).outbox;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const cookieOf = (res: request.Response) =>
  (res.headers['set-cookie'] as unknown as string[])
    .find((cookie) => cookie.startsWith('apex_refresh='))!
    .split(';')[0]
    .split('=')[1];

const student = (overrides: Record<string, unknown> = {}) => ({
  cedula: '9000000001',
  fullName: 'Ana Gómez',
  email: 'ana.gomez@elpoli.edu.co',
  password: 'password123',
  ...overrides,
});

const waitForMail = async (count: number) => {
  for (let attempt = 0; attempt < 20 && outbox.length < count; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const tokenFrom = (message: { text: string }) => message.text.match(/#token=([\w-]+)/)![1];

afterAll(async () => {
  await database.destroy();
});

describe('institutional email', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('requires an @elpoli.edu.co address when registering', async () => {
    const missing = await api.post(`${base}/auth/register/student`).send(student({ email: undefined }));
    const gmail = await api.post(`${base}/auth/register/student`).send(student({ email: 'ana@gmail.com' }));
    const lookalike = await api
      .post(`${base}/auth/register/student`)
      .send(student({ email: 'ana@elpoli.edu.co.evil.com' }));
    const subdomain = await api
      .post(`${base}/auth/register/student`)
      .send(student({ email: 'ana@fake-elpoli.edu.co' }));

    expect([missing.status, gmail.status, lookalike.status, subdomain.status]).toEqual([400, 400, 400, 400]);
    expect(gmail.body.details[0].message).toContain('@elpoli.edu.co');
  });

  it('normalizes the email and rejects duplicates with a clear message', async () => {
    const created = await api
      .post(`${base}/auth/register/student`)
      .send(student({ email: '  Ana.Gomez@ELPOLI.edu.co ' }));
    expect(created.status).toBe(201);
    expect(created.body.payload.user.email).toBe('ana.gomez@elpoli.edu.co');

    const duplicate = await api
      .post(`${base}/auth/register/student`)
      .send(student({ cedula: '9000000002', email: 'ANA.GOMEZ@elpoli.edu.co' }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain('correo');

    const sameCedula = await api.post(`${base}/auth/register/student`).send(student({ email: 'otra@elpoli.edu.co' }));
    expect(sameCedula.status).toBe(409);
    expect(sameCedula.body.message).toContain('cédula');
  });
});

describe('password recovery and change', () => {
  let access: string;

  beforeAll(async () => {
    await resetDatabase();
    const res = await api.post(`${base}/auth/register/student`).send(student());
    access = res.body.payload.accessToken;
  });

  beforeEach(() => {
    outbox.length = 0;
  });

  it('answers the same way for known and unknown emails and only mails real accounts', async () => {
    const known = await api.post(`${base}/auth/forgot-password`).send({ email: 'ANA.GOMEZ@elpoli.edu.co' });
    const unknown = await api.post(`${base}/auth/forgot-password`).send({ email: 'nadie@elpoli.edu.co' });
    await waitForMail(1);

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('ana.gomez@elpoli.edu.co');
    expect(outbox[0].text).toContain('/restablecer-contrasena#token=');
  });

  it('stores only a hash of the reset token', async () => {
    await database('password_reset_tokens').delete();
    await api.post(`${base}/auth/forgot-password`).send({ email: 'ana.gomez@elpoli.edu.co' });
    await waitForMail(1);
    const token = tokenFrom(outbox[0]);
    const rows = await database('password_reset_tokens');
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('resets the password once, closes every session and invalidates the link', async () => {
    await database('password_reset_tokens').delete();
    const login = await api.post(`${base}/auth/login`).send({ cedula: '9000000001', password: 'password123' });
    const refresh = cookieOf(login);

    await api.post(`${base}/auth/forgot-password`).send({ email: 'ana.gomez@elpoli.edu.co' });
    await waitForMail(1);
    const token = tokenFrom(outbox[0]);

    const weak = await api.post(`${base}/auth/reset-password`).send({ token, password: 'short' });
    expect(weak.status).toBe(400);

    outbox.length = 0;
    const reset = await api.post(`${base}/auth/reset-password`).send({ token, password: 'nueva-clave-1' });
    expect(reset.status).toBe(200);
    await waitForMail(1);
    expect(outbox[0].subject).toContain('actualizada');
    expect(outbox[0].to).toBe('ana.gomez@elpoli.edu.co');

    expect((await api.post(`${base}/auth/reset-password`).send({ token, password: 'otra-clave-22' })).status).toBe(400);
    expect((await api.post(`${base}/auth/login`).send({ cedula: '9000000001', password: 'password123' })).status).toBe(
      401,
    );
    expect(
      (await api.post(`${base}/auth/login`).send({ cedula: '9000000001', password: 'nueva-clave-1' })).status,
    ).toBe(200);
    expect((await api.post(`${base}/auth/refresh`).set({ Cookie: `apex_refresh=${refresh}` })).status).toBe(401);
  });

  it('rejects expired and unknown reset tokens', async () => {
    await database('password_reset_tokens').delete();
    await api.post(`${base}/auth/forgot-password`).send({ email: 'ana.gomez@elpoli.edu.co' });
    await waitForMail(1);
    const token = tokenFrom(outbox[0]);
    await database('password_reset_tokens').update({ expires_at: new Date(Date.now() - 1000) });

    expect((await api.post(`${base}/auth/reset-password`).send({ token, password: 'nueva-clave-2' })).status).toBe(400);
    expect(
      (await api.post(`${base}/auth/reset-password`).send({ token: 'x'.repeat(40), password: 'nueva-clave-2' })).status,
    ).toBe(400);
  });

  it('does not send another email during the cooldown', async () => {
    await database('password_reset_tokens').delete();
    await api.post(`${base}/auth/forgot-password`).send({ email: 'ana.gomez@elpoli.edu.co' });
    await api.post(`${base}/auth/forgot-password`).send({ email: 'ana.gomez@elpoli.edu.co' });
    await waitForMail(1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(outbox).toHaveLength(1);
  });

  it('changes the password for a signed in user and keeps that device signed in', async () => {
    const login = await api.post(`${base}/auth/login`).send({ cedula: '9000000001', password: 'nueva-clave-1' });
    const oldRefresh = cookieOf(login);
    access = login.body.payload.accessToken;

    const wrong = await api
      .post(`${base}/auth/change-password`)
      .set(bearer(access))
      .send({ currentPassword: 'incorrecta', newPassword: 'clave-nueva-3' });
    expect(wrong.status).toBe(400);

    const same = await api
      .post(`${base}/auth/change-password`)
      .set(bearer(access))
      .send({ currentPassword: 'nueva-clave-1', newPassword: 'nueva-clave-1' });
    expect(same.status).toBe(400);

    const unauthenticated = await api
      .post(`${base}/auth/change-password`)
      .send({ currentPassword: 'nueva-clave-1', newPassword: 'clave-nueva-3' });
    expect(unauthenticated.status).toBe(401);

    const changed = await api
      .post(`${base}/auth/change-password`)
      .set(bearer(access))
      .send({ currentPassword: 'nueva-clave-1', newPassword: 'clave-nueva-3' });
    expect(changed.status).toBe(200);
    expect(changed.body.payload.accessToken).toBeDefined();
    await waitForMail(1);
    expect(outbox[0].subject).toContain('actualizada');

    const newRefresh = cookieOf(changed);
    expect((await api.post(`${base}/auth/refresh`).set({ Cookie: `apex_refresh=${oldRefresh}` })).status).toBe(401);
    expect((await api.post(`${base}/auth/refresh`).set({ Cookie: `apex_refresh=${newRefresh}` })).status).toBe(200);
    expect(
      (await api.post(`${base}/auth/login`).send({ cedula: '9000000001', password: 'clave-nueva-3' })).status,
    ).toBe(200);
  });
});
