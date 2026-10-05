import request from 'supertest';
import server from '../server';
import database from '../lib/database';
import { resetDatabase } from './reset-database';
import { hashPassword } from '../lib/hash';
import { normalizeName } from '../lib/normalize';
import { buildConnection } from '../lib/connection';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

describe('offline awards and roster', () => {
  let teacherToken: string;
  let studentToken: string;
  let offeringId: string;
  let otherOfferingId: string;

  beforeAll(async () => {
    await resetDatabase();
    await database('users').insert({
      cedula: '1000000001',
      full_name: 'Admin Offline',
      full_name_search: normalizeName('Admin Offline'),
      password_hash: await hashPassword('password123'),
      role: 'super_admin',
      status: 'active',
    });
    const login = await api.post(`${base}/auth/login`).send({ cedula: '1000000001', password: 'password123' });
    const adminToken = login.body.payload.accessToken;

    const invite = await api.post(`${base}/admin/invites`).set(bearer(adminToken)).send({});
    const teacher = await api.post(`${base}/auth/register/teacher`).send({
      cedula: '5000000001',
      fullName: 'Profe Offline',
      email: 'profe.offline@elpoli.edu.co',
      password: 'password123',
      inviteCode: invite.body.payload.code,
    });
    teacherToken = teacher.body.payload.accessToken;

    const offering = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: '101', courseName: 'Algoritmos I', term: '2026-2' });
    offeringId = offering.body.payload.id;
    const other = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: '102', courseName: 'Algoritmos II', term: '2026-2' });
    otherOfferingId = other.body.payload.id;

    const student = await api.post(`${base}/auth/register/student`).send({
      cedula: '6000000001',
      fullName: 'Estudiante Offline',
      email: 'estudiante.offline@elpoli.edu.co',
      password: 'password123',
      offeringIds: [offeringId],
    });
    studentToken = student.body.payload.accessToken;
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('syncs queued awards idempotently and reports rejections per item', async () => {
    const qr = (await api.get(`${base}/polipoints/me/qr`).set(bearer(studentToken))).body.payload.token;
    const item = (overrides: Record<string, unknown>) => ({
      qrToken: qr,
      offeringId,
      points: 10,
      idempotencyKey: 'offline-key-0001',
      occurredAt: hoursAgo(2),
      ...overrides,
    });

    const response = await api
      .post(`${base}/polipoints/awards/batch`)
      .set(bearer(teacherToken))
      .send({
        items: [
          item({}),
          item({ idempotencyKey: 'offline-key-0002', offeringId: otherOfferingId }),
          item({ idempotencyKey: 'offline-key-0003', points: 5000 }),
          item({ idempotencyKey: 'offline-key-0004', occurredAt: hoursAgo(-2) }),
          item({ idempotencyKey: 'offline-key-0005', occurredAt: hoursAgo(24 * 30) }),
          item({ idempotencyKey: 'offline-key-0006', qrToken: 'not-a-token' }),
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.payload.map((result: { status: string }) => result.status)).toEqual([
      'created',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
    ]);

    const retry = await api
      .post(`${base}/polipoints/awards/batch`)
      .set(bearer(teacherToken))
      .send({ items: [item({})] });
    expect(retry.body.payload[0].status).toBe('duplicate');

    const summary = await api.get(`${base}/polipoints/me`).set(bearer(studentToken));
    expect(summary.body.payload.total).toBe(10);
  });

  it('rejects items with a rotated qr', async () => {
    const stale = (await api.get(`${base}/polipoints/me/qr`).set(bearer(studentToken))).body.payload.token;
    await api.post(`${base}/polipoints/me/qr/rotate`).set(bearer(studentToken));

    const response = await api
      .post(`${base}/polipoints/awards/batch`)
      .set(bearer(teacherToken))
      .send({
        items: [
          {
            qrToken: stale,
            offeringId,
            points: 5,
            idempotencyKey: 'offline-key-0007',
            occurredAt: hoursAgo(1),
          },
        ],
      });
    expect(response.body.payload[0]).toMatchObject({
      status: 'rejected',
      error: expect.stringContaining('Este QR ya no es válido'),
    });
  });

  it('accepts manual awards by student id and records their source', async () => {
    const studentId = (await database('users').where({ cedula: '6000000001' }).first()).id;
    const manual = (overrides: Record<string, unknown>) => ({
      studentId,
      offeringId,
      points: 15,
      idempotencyKey: 'manual-key-0001',
      occurredAt: hoursAgo(1),
      ...overrides,
    });

    const response = await api
      .post(`${base}/polipoints/awards/batch`)
      .set(bearer(teacherToken))
      .send({
        items: [
          manual({}),
          manual({ idempotencyKey: 'manual-key-0002', offeringId: otherOfferingId }),
          manual({ idempotencyKey: 'manual-key-0003', studentId: undefined }),
        ],
      });
    expect(response.body.payload.map((result: { status: string }) => result.status)).toEqual([
      'created',
      'rejected',
      'rejected',
    ]);

    const direct = await api.post(`${base}/polipoints/awards`).set(bearer(teacherToken)).send({
      studentId,
      offeringId,
      points: 5,
      idempotencyKey: 'manual-key-0004',
      source: 'manual',
    });
    expect(direct.status).toBe(201);

    const sources = await database('polipoint_awards')
      .whereIn('idempotency_key', ['manual-key-0001', 'manual-key-0004', 'offline-key-0001'])
      .select('idempotency_key', 'source')
      .orderBy('idempotency_key');
    expect(sources.map((row) => row.source)).toEqual(['manual', 'manual', 'qr']);
  });

  it('returns the teacher roster for offline lookup', async () => {
    const roster = await api.get(`${base}/polipoints/roster`).set(bearer(teacherToken));
    expect(roster.status).toBe(200);
    expect(roster.body.payload.offerings).toHaveLength(2);
    expect(roster.body.payload.students).toEqual([
      expect.objectContaining({ cedula: '6000000001', offeringIds: [offeringId], total: 30 }),
    ]);

    const forbidden = await api.get(`${base}/polipoints/roster`).set(bearer(studentToken));
    expect(forbidden.status).toBe(403);
  });
});

describe('database connection', () => {
  const url = 'postgres://user:pass@host:5432/db';

  it('omits ssl by default', () => {
    expect(buildConnection({ DATABASE_URL: url })).toEqual({ connectionString: url });
  });

  it('enables ssl from env', () => {
    expect(buildConnection({ DATABASE_URL: url, DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'false' })).toEqual({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  });

  it('passes the ca certificate', () => {
    const connection = buildConnection({ DATABASE_URL: url, DB_SSL: 'true', DB_SSL_CA: 'line1\\nline2' });
    expect(connection).toMatchObject({ ssl: { rejectUnauthorized: true, ca: 'line1\nline2' } });
  });
});
