import request from 'supertest';
import server from '../server';
import Database from '../lib/database';
import { insertUser, resetDatabase } from './reset-database';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerTeacherWithInvite(cedula: string, fullName: string, inviteCode: string) {
  const email = `${cedula}@elpoli.edu.co`;
  const res = await api
    .post(`${base}/auth/register/teacher`)
    .send({ cedula, fullName, email, password: 'password123', inviteCode });
  return res.body.payload.accessToken as string;
}

describe('polipuntos api', () => {
  let adminToken: string;

  beforeAll(async () => {
    await resetDatabase();
    await insertUser('1000000000', 'Super Admin', 'super_admin');
    const login = await api.post(`${base}/auth/login`).send({ cedula: '1000000000', password: 'password123' });
    adminToken = login.body.payload.accessToken;
  });

  afterAll(async () => {
    await Database.close();
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

    const lowercase = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: 'ing004', courseName: 'Ingeniería', term: '2026-2' });
    expect(lowercase.status).toBe(201);
    expect(lowercase.body.payload.courseCode).toBe('ING004');

    const dashed = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: 'ING-005', courseName: 'Con guion', term: '2026-2' });
    expect(dashed.status).toBe(400);

    const badTerm = await api
      .post(`${base}/offerings`)
      .set(bearer(teacherToken))
      .send({ courseCode: 'ING006', courseName: 'Periodo malo', term: '2026-3' });
    expect(badTerm.status).toBe(400);

    const publicList = await api.get(`${base}/offerings/public`);
    expect(publicList.body.payload).toHaveLength(4);

    const student = await api.post(`${base}/auth/register/student`).send({
      cedula: '1.234.567.890',
      fullName: 'María José Pérez',
      email: 'maria.perez@elpoli.edu.co',
      password: 'password123',
      offeringIds: [o1.body.payload.id, o2.body.payload.id, o3.body.payload.id],
    });
    expect(student.status).toBe(201);
    const studentToken = student.body.payload.accessToken as string;

    const dupStudent = await api
      .post(`${base}/auth/register/student`)
      .send({ cedula: '1234567890', fullName: 'Otra Persona', email: 'otra@elpoli.edu.co', password: 'password123' });
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

    const penalty = await api.post(`${base}/polipoints/awards`).set(bearer(teacher2Token)).send({
      studentId,
      offeringId: o3.body.payload.id,
      points: -5,
      idempotencyKey: 'key-0005-eeee',
    });
    expect(penalty.status).toBe(201);
    expect(penalty.body.payload.points).toBe(-5);

    const zero = await api.post(`${base}/polipoints/awards`).set(bearer(teacher2Token)).send({
      studentId,
      offeringId: o3.body.payload.id,
      points: 0,
      idempotencyKey: 'key-0006-ffff',
    });
    expect(zero.status).toBe(400);

    const afterPenalty = await api.get(`${base}/polipoints/me`).set(bearer(studentToken));
    expect(afterPenalty.body.payload.total).toBe(65);

    const dashboard = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ q: 'maria jose', minPoints: 10 });
    expect(dashboard.body.total).toBe(1);
    expect(dashboard.body.payload[0]).toMatchObject({ cedula: '1234567890', points: 50 });

    const byCedula = await api.get(`${base}/teacher/students`).set(bearer(teacherToken)).query({ q: '1234567' });
    expect(byCedula.body.total).toBeGreaterThan(0);

    const capped = await api.get(`${base}/teacher/students`).set(bearer(teacherToken)).query({ maxPoints: 5 });
    expect(capped.body.payload.every((row: { points: number }) => row.points <= 5)).toBe(true);

    const sorted = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ sort: 'points', order: 'desc', limit: 1 });
    expect(sorted.body.payload).toHaveLength(1);
    expect(sorted.body.payload[0].points).toBe(50);
    expect(sorted.body.total).toBeGreaterThan(1);

    const hostile = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ q: "'; DROP TABLE users; --" });
    expect(hostile.status).toBe(200);
    expect(hostile.body.total).toBe(0);

    const badSort = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ sort: 'password_hash' });
    expect(badSort.status).toBe(400);

    const byOffering = await api
      .get(`${base}/teacher/students`)
      .set(bearer(teacherToken))
      .query({ offeringId: o2.body.payload.id });
    expect(byOffering.body.payload[0].points).toBe(0);

    const pagedPublic = await api.get(`${base}/offerings/public`).query({ page: 2, limit: 3 });
    expect(pagedPublic.body.payload).toHaveLength(1);
    expect(pagedPublic.body).toMatchObject({ total: 4, page: 2, limit: 3 });

    const pagedMine = await api.get(`${base}/offerings/mine`).set(bearer(teacherToken)).query({ limit: 2 });
    expect(pagedMine.body.payload).toHaveLength(2);
    expect(pagedMine.body.total).toBe(3);

    const pagedMyEnrollments = await api
      .get(`${base}/enrollments/mine`)
      .set(bearer(studentToken))
      .query({ page: 1, limit: 1 });
    expect(pagedMyEnrollments.body.payload).toHaveLength(1);
    expect(pagedMyEnrollments.body.total).toBeGreaterThan(1);

    const pagedHistory = await api.get(`${base}/polipoints/me`).set(bearer(studentToken)).query({ limit: 1 });
    expect(pagedHistory.body.payload.history).toHaveLength(1);
    expect(pagedHistory.body.payload.historyTotal).toBeGreaterThan(1);

    const pagedDetail = await api
      .get(`${base}/teacher/students/${studentId}`)
      .set(bearer(teacherToken))
      .query({ limit: 1 });
    expect(pagedDetail.body.payload.history).toHaveLength(1);
    expect(pagedDetail.body.payload.historyTotal).toBeGreaterThanOrEqual(1);

    const pagedRoster = await api.get(`${base}/polipoints/roster`).set(bearer(teacherToken)).query({ limit: 1 });
    expect(pagedRoster.body.total).toBeGreaterThan(1);
    expect(pagedRoster.body.payload.students).toHaveLength(1);

    const hostileLimits = [
      { path: `${base}/offerings/public`, query: { limit: 101 } },
      { path: `${base}/offerings/public`, query: { limit: 0 } },
      { path: `${base}/offerings/public`, query: { page: 0 } },
      { path: `${base}/offerings/public`, query: { limit: '999999999' } },
      { path: `${base}/offerings/mine`, query: { limit: 101 }, token: teacherToken },
      { path: `${base}/enrollments/mine`, query: { limit: 101 }, token: studentToken },
      { path: `${base}/polipoints/roster`, query: { limit: 101 }, token: teacherToken },
      { path: `${base}/polipoints/me`, query: { limit: 101 }, token: studentToken },
      { path: `${base}/teacher/students`, query: { limit: 101 }, token: teacherToken },
      { path: `${base}/teacher/students/${studentId}`, query: { limit: 101 }, token: teacherToken },
      { path: `${base}/teacher/students/export`, query: { limit: 5001 }, token: teacherToken },
    ];
    for (const { path, query, token } of hostileLimits) {
      const request = api.get(path).query(query);
      const response = await (token ? request.set(bearer(token)) : request);
      expect([path, response.status]).toEqual([path, 400]);
    }

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
    expect(afterRevoke.body.payload.total).toBe(15);

    const rotated = await api.post(`${base}/polipoints/me/qr/rotate`).set(bearer(studentToken));
    expect(rotated.status).toBe(200);
    const oldScan = await api
      .post(`${base}/polipoints/scan`)
      .set(bearer(teacherToken))
      .send({ token: qr.body.payload.token });
    expect(oldScan.status).toBe(400);
  });

  it('keeps teachers without invite pending until approved', async () => {
    const reg = await api.post(`${base}/auth/register/teacher`).send({
      cedula: '3000000001',
      fullName: 'Profe Pendiente',
      email: 'pendiente@elpoli.edu.co',
      password: 'password123',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.payload.accessToken).toBeUndefined();

    const login = await api.post(`${base}/auth/login`).send({ cedula: '3000000001', password: 'password123' });
    expect(login.status).toBe(403);

    const pendingList = await api
      .get(`${base}/admin/teachers`)
      .set(bearer(adminToken))
      .query({ status: 'pending_approval', page: 1, limit: 100 });
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.total).toBe(1);

    const allTeachers = await api.get(`${base}/admin/teachers`).set(bearer(adminToken)).query({ page: 1, limit: 100 });
    expect(allTeachers.status).toBe(200);

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
      .send({ cedula: '4000000001', fullName: 'Admin Dos', email: 'admin2@elpoli.edu.co', password: 'password123' });
    expect(created.status).toBe(201);

    const adminLogin = await api.post(`${base}/auth/login`).send({ cedula: '4000000001', password: 'password123' });
    const denied = await api
      .post(`${base}/admin/admins`)
      .set(bearer(adminLogin.body.payload.accessToken))
      .send({ cedula: '4000000002', fullName: 'Admin Tres', email: 'admin3@elpoli.edu.co', password: 'password123' });
    expect(denied.status).toBe(403);
  });

  it('lets admins sign in with their email while everyone else uses the cedula', async () => {
    await Database.execute(`UPDATE users SET email = 'apex@elpoli.edu.co' WHERE cedula = '1000000000'`, [], {
      queryId: 'test.setAdminEmail',
    });

    const byEmail = await api.post(`${base}/auth/login`).send({ identifier: 'APEX@elpoli.edu.co', password: 'password123' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.payload.user.role).toBe('super_admin');

    const byCedula = await api.post(`${base}/auth/login`).send({ identifier: '1000000000', password: 'password123' });
    expect(byCedula.status).toBe(200);

    const wrongPassword = await api.post(`${base}/auth/login`).send({ identifier: 'apex@elpoli.edu.co', password: 'otra' });
    expect(wrongPassword.status).toBe(401);

    const teacher = await api
      .post(`${base}/auth/register/teacher`)
      .send({ cedula: '5000000001', fullName: 'Profe Correo', email: 'profe.correo@elpoli.edu.co', password: 'password123' });
    expect(teacher.status).toBe(201);
    const teacherByEmail = await api
      .post(`${base}/auth/login`)
      .send({ identifier: 'profe.correo@elpoli.edu.co', password: 'password123' });
    expect(teacherByEmail.status).toBe(401);
  });
});
