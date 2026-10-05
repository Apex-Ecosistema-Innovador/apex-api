import request from 'supertest';
import server from '../server';
import database from '../lib/database';
import { resetDatabase } from './reset-database';
import { hashPassword } from '../lib/hash';
import { normalizeName } from '../lib/normalize';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerTeacherWithInvite(cedula: string, fullName: string, inviteCode: string) {
  const res = await api
    .post(`${base}/auth/register/teacher`)
    .send({ cedula, fullName, password: 'password123', inviteCode });
  return res.body.payload.accessToken as string;
}

describe('polipuntos api', () => {
  let adminToken: string;

  beforeAll(async () => {
    await resetDatabase();
    await database('users').insert({
      cedula: '1000000000',
      full_name: 'Super Admin',
      full_name_search: normalizeName('Super Admin'),
      password_hash: await hashPassword('password123'),
      role: 'super_admin',
      status: 'active',
    });
    const login = await api.post(`${base}/auth/login`).send({ cedula: '1000000000', password: 'password123' });
    adminToken = login.body.payload.accessToken;
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('runs the full teacher and student flow', async () => {
    const invite = await api.post(`${base}/admin/invites`).set(bearer(adminToken)).send({});
    expect(invite.status).toBe(201);

    const teacherToken = await registerTeacherWithInvite('2000000001', 'Profe Uno', invite.body.payload.code);
    const invite2 = await api.post(`${base}/admin/invites`).set(bearer(adminToken)).send({});
    const teacher2Token = await registerTeacherWithInvite('2000000002', 'Profe Dos', invite2.body.payload.code);

    const o1 = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: '001', courseName: 'Algoritmos I', term: '2026-2' });
    const o2 = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: '002', courseName: 'Algoritmos II', term: '2026-2' });
    const o3 = await api
      .post(`${base}/offerings`)
      .set(bearer(teacher2Token))
      .send({ courseCode: '003', courseName: 'Algoritmos III', term: '2026-2' });
    expect([o1.status, o2.status, o3.status]).toEqual([201, 201, 201]);

    const duplicate = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: '001', courseName: 'Duplicado', term: '2026-2' });
    expect(duplicate.status).toBe(409);

    const publicList = await api.get(`${base}/offerings/public`);
    expect(publicList.body.payload).toHaveLength(3);

    const student = await api.post(`${base}/auth/register/student`).send({
      cedula: '1.234.567.890',
      fullName: 'María José Pérez',
      password: 'password123',
      offeringIds: [o1.body.payload.id, o2.body.payload.id, o3.body.payload.id],
    });
    expect(student.status).toBe(201);
    const studentToken = student.body.payload.accessToken as string;

    const dupStudent = await api
      .post(`${base}/auth/register/student`)
      .send({ cedula: '1234567890', fullName: 'Otra Persona', password: 'password123' });
    expect(dupStudent.status).toBe(409);

    const qr = await api.get(`${base}/polipoints/me/qr`).set(bearer(studentToken));
    const scan = await api
      .post(`${base}/polipoints/scan`)
      .set(bearer(teacherToken))
      .send({ token: qr.body.payload.token });
    expect(scan.status).toBe(200);
    expect(scan.body.payload.offerings).toHaveLength(2);

    const studentId = scan.body.payload.student.id;
    const award = await api.post(`${base}/polipoints/awards`).set(bearer(teacherToken)).send({
      studentId,
      offeringId: o1.body.payload.id,
      points: 50,
      idempotencyKey: 'key-0001-aaaa',
    });
    expect(award.status).toBe(201);

    const repeated = await api.post(`${base}/polipoints/awards`).set(bearer(teacherToken)).send({
      studentId,
      offeringId: o1.body.payload.id,
      points: 50,
      idempotencyKey: 'key-0001-aaaa',
    });
    expect(repeated.body.payload.id).toBe(award.body.payload.id);

    const tooMany = await api.post(`${base}/polipoints/awards`).set(bearer(teacherToken)).send({
      studentId,
      offeringId: o1.body.payload.id,
      points: 1001,
      idempotencyKey: 'key-0002-bbbb',
    });
    expect(tooMany.status).toBe(400);

    const foreignOffering = await api.post(`${base}/polipoints/awards`).set(bearer(teacherToken)).send({
      studentId,
      offeringId: o3.body.payload.id,
      points: 5,
      idempotencyKey: 'key-0003-cccc',
    });
    expect(foreignOffering.status).toBe(404);

    await api.post(`${base}/polipoints/awards`).set(bearer(teacher2Token)).send({
      studentId,
      offeringId: o3.body.payload.id,
      points: 20,
      idempotencyKey: 'key-0004-dddd',
    });

    const summary = await api.get(`${base}/polipoints/me`).set(bearer(studentToken));
    expect(summary.body.payload.total).toBe(70);

    const dashboard = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ q: 'maria jose', minPoints: 10 });
    expect(dashboard.body.total).toBe(1);
    expect(dashboard.body.payload[0]).toMatchObject({ cedula: '1234567890', points: 50 });

    const byOffering = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ offeringId: o2.body.payload.id });
    expect(byOffering.body.payload[0].points).toBe(0);

    const csv = await api.get(`${base}/teacher/students/export`).set(bearer(teacherToken));
    expect(csv.text).toContain('1234567890');

    const revoked = await api
      .post(`${base}/polipoints/awards/${award.body.payload.id}/revoke`)
      .set(bearer(teacherToken))
      .send({ reason: 'error' });
    expect(revoked.status).toBe(200);
    const again = await api
      .post(`${base}/polipoints/awards/${award.body.payload.id}/revoke`)
      .set(bearer(teacherToken))
      .send({});
    expect(again.status).toBe(409);

    const afterRevoke = await api.get(`${base}/polipoints/me`).set(bearer(studentToken));
    expect(afterRevoke.body.payload.total).toBe(20);

    const rotated = await api.post(`${base}/polipoints/me/qr/rotate`).set(bearer(studentToken));
    expect(rotated.status).toBe(200);
    const oldScan = await api
      .post(`${base}/polipoints/scan`)
      .set(bearer(teacherToken))
      .send({ token: qr.body.payload.token });
    expect(oldScan.status).toBe(400);
  });

  it('keeps teachers without invite pending until approved', async () => {
    const reg = await api
      .post(`${base}/auth/register/teacher`)
      .send({ cedula: '3000000001', fullName: 'Profe Pendiente', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.payload.accessToken).toBeUndefined();

    const login = await api.post(`${base}/auth/login`).send({ cedula: '3000000001', password: 'password123' });
    expect(login.status).toBe(403);

    const approve = await api
      .patch(`${base}/admin/teachers/${reg.body.payload.user.id}/approve`)
      .set(bearer(adminToken));
    expect(approve.status).toBe(200);

    const loginAfter = await api.post(`${base}/auth/login`).send({ cedula: '3000000001', password: 'password123' });
    expect(loginAfter.status).toBe(200);
  });

  it('restricts admin creation to the super admin', async () => {
    const created = await api
      .post(`${base}/admin/admins`)
      .set(bearer(adminToken))
      .send({ cedula: '4000000001', fullName: 'Admin Dos', password: 'password123' });
    expect(created.status).toBe(201);

    const adminLogin = await api.post(`${base}/auth/login`).send({ cedula: '4000000001', password: 'password123' });
    const denied = await api
      .post(`${base}/admin/admins`)
      .set(bearer(adminLogin.body.payload.accessToken))
      .send({ cedula: '4000000002', fullName: 'Admin Tres', password: 'password123' });
    expect(denied.status).toBe(403);
  });
});
