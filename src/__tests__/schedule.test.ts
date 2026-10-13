import request from 'supertest';
import server from '../server';
import Database from '../lib/database';
import { insertUser, resetDatabase } from './reset-database';
import { parseScheduleText } from '../lib/schedule-parser';
import { termFor } from '../lib/term';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const escapePdf = (text: string) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildPdf = (lines: string[]) => {
  const stream = `BT /F1 10 Tf 40 780 Td 14 TL ${lines.map((line) => `(${escapePdf(line)}) Tj T*`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1');
};

const schedulePdf = (document: string, term: string, courses: [string, string][]) =>
  buildPdf([
    `Nombre y apellidos Doc. Ident. ESTUDIANTE DE PRUEBA ${document}`,
    `Curso Academico Centro Plan ${term}S SEDE CENTRAL MEDELLIN 8210-INGENIERIA`,
    ...courses.map(([code, name]) => `[${code}] ${name}`),
  ]);

const uploadSchedule = (token: string, file: Buffer, filename = 'horario.pdf') =>
  api.post(`${base}/schedule`).set(bearer(token)).attach('file', file, { filename, contentType: 'application/pdf' });

describe('student schedule and ranking', () => {
  let adminToken: string;
  let teacherA: { token: string; id: string };
  let teacherB: { token: string; id: string };
  let teacherC: { token: string; id: string };
  const offerings: Record<string, string> = {};

  const registerTeacher = async (cedula: string, name: string, email: string) => {
    const invite = await api.post(`${base}/admin/invites`).set(bearer(adminToken)).send({});
    const response = await api.post(`${base}/auth/register/teacher`).send({
      cedula,
      fullName: name,
      email,
      password: 'password123',
      inviteCode: invite.body.payload.code,
    });
    return { token: response.body.payload.accessToken as string, id: response.body.payload.user.id as string };
  };

  const registerStudent = async (cedula: string, name: string) => {
    const response = await api
      .post(`${base}/auth/register/student`)
      .send({ cedula, fullName: name, email: `${cedula}@elpoli.edu.co`, password: 'password123' });
    return { token: response.body.payload.accessToken as string, id: response.body.payload.user.id as string };
  };

  const createOffering = async (teacher: { token: string }, code: string, name: string, term = '2026-2') => {
    const response = await api
      .post(`${base}/offerings`)
      .set(bearer(teacher.token))
      .send({ courseCode: code, courseName: name, term });
    return response.body.payload.id as string;
  };

  beforeAll(async () => {
    await resetDatabase();
    await insertUser('1000000001', 'Admin Horario', 'super_admin');
    const login = await api.post(`${base}/auth/login`).send({ cedula: '1000000001', password: 'password123' });
    adminToken = login.body.payload.accessToken;

    teacherA = await registerTeacher('5100000001', 'Ignacio Londoño Ossa', 'ignacio@elpoli.edu.co');
    teacherB = await registerTeacher('5100000002', 'Yamid Osorio Agudelo', 'yamid@elpoli.edu.co');
    teacherC = await registerTeacher('5100000003', 'Gladys Vasquez Echavarria', 'gladys@elpoli.edu.co');

    offerings.redes = await createOffering(teacherA, 'ING01209', 'Gestion de redes y servicios');
    offerings.modelosB = await createOffering(teacherB, 'ING01210', 'Modelos y simulacion');
    offerings.modelosC = await createOffering(teacherC, 'ING01210', 'Modelos y simulacion');
    offerings.anterior = await createOffering(teacherA, 'ING01299', 'Asignatura del semestre pasado', '2026-1');
  });

  afterAll(async () => {
    await Database.close();
  });

  it('parses the academic portal schedule text', () => {
    const parsed = parseScheduleText(
      [
        'Nombre y apellidos Doc. Ident.\tESTUDIANTE DE PRUEBA 1012345678',
        'Curso Académico Centro Plan\t2026-2S SEDE CENTRAL MEDELLÍN 8210-INGENIERIA INFORMATICA',
        '[ING01209] GESTION DE REDES Y SERVICIOS',
        '[ING01209] GESTION DE REDES Y SERVICIOS',
        '[ING01208] FORMULACION Y EVALUACION DE PROYECTOS DE',
        'TI',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      term: '2026-2',
      document: '1012345678',
      courses: [
        { courseCode: 'ING01209', courseName: 'GESTION DE REDES Y SERVICIOS' },
        { courseCode: 'ING01208', courseName: 'FORMULACION Y EVALUACION DE PROYECTOS DE' },
      ],
    });
    expect(parseScheduleText('texto cualquiera')).toBeNull();
  });

  it('computes the academic term from the date in Bogota time', () => {
    expect(termFor(new Date('2026-03-01T12:00:00Z'))).toBe('2026-1');
    expect(termFor(new Date('2026-08-03T12:00:00Z'))).toBe('2026-2');
    expect(termFor(new Date('2027-01-01T03:00:00Z'))).toBe('2026-2');
  });

  it('links unambiguous courses, offers a choice for shared ones and reports missing ones', async () => {
    const student = await registerStudent('6100000001', 'Estudiante Horario');

    const before = await api.get(`${base}/schedule/current`).set(bearer(student.token));
    expect(before.body.payload).toMatchObject({ term: '2026-2', uploaded: false, items: [] });

    const file = schedulePdf('6100000001', '2026-2', [
      ['ING01209', 'GESTION DE REDES Y SERVICIOS'],
      ['ING01210', 'MODELOS Y SIMULACION'],
      ['ING01207', 'PROYECTO INTEGRADOR'],
    ]);
    const uploaded = await uploadSchedule(student.token, file);
    expect(uploaded.status).toBe(201);

    const byCode = Object.fromEntries(
      uploaded.body.payload.items.map((item: { courseCode: string }) => [item.courseCode, item]),
    );
    expect(uploaded.body.payload.uploaded).toBe(true);
    expect(byCode.ING01209).toMatchObject({ status: 'linked', linkedOfferingId: offerings.redes });
    expect(byCode.ING01210.status).toBe('choose');
    expect(byCode.ING01210.options.map((option: { offeringId: string }) => option.offeringId).sort()).toEqual(
      [offerings.modelosB, offerings.modelosC].sort(),
    );
    expect(byCode.ING01207).toMatchObject({ status: 'unavailable', options: [] });

    const mine = await api.get(`${base}/enrollments/mine`).set(bearer(student.token));
    expect(mine.body.payload.map((item: { id: string }) => item.id)).toEqual([offerings.redes]);

    const enroll = await api
      .post(`${base}/enrollments`)
      .set(bearer(student.token))
      .send({ offeringId: offerings.modelosC });
    expect(enroll.status).toBe(201);

    const after = await api.get(`${base}/schedule/current`).set(bearer(student.token));
    const linked = after.body.payload.items.find((item: { courseCode: string }) => item.courseCode === 'ING01210');
    expect(linked).toMatchObject({ status: 'linked', linkedOfferingId: offerings.modelosC });

    offerings.proyecto = await createOffering(teacherA, 'ING01207', 'Proyecto integrador');
    const synced = await api.post(`${base}/schedule/sync`).set(bearer(student.token));
    expect(synced.status).toBe(200);
    const proyecto = synced.body.payload.items.find((item: { courseCode: string }) => item.courseCode === 'ING01207');
    expect(proyecto).toMatchObject({ status: 'linked', linkedOfferingId: offerings.proyecto });
  });

  it('replaces the stored courses when the schedule is uploaded again', async () => {
    const student = await registerStudent('6100000002', 'Estudiante Reemplazo');
    await uploadSchedule(student.token, schedulePdf('6100000002', '2026-2', [['ING01209', 'REDES']]));
    const second = await uploadSchedule(student.token, schedulePdf('6100000002', '2026-2', [['ING01210', 'MODELOS']]));
    expect(second.body.payload.items.map((item: { courseCode: string }) => item.courseCode)).toEqual(['ING01210']);
  });

  it('rejects schedules that are not valid, not current or not the student own', async () => {
    const student = await registerStudent('6100000003', 'Estudiante Rechazo');

    const otherPerson = await uploadSchedule(student.token, schedulePdf('9999999999', '2026-2', [['ING01209', 'X']]));
    expect(otherPerson.status).toBe(403);

    const oldTerm = await uploadSchedule(student.token, schedulePdf('6100000003', '2026-1', [['ING01209', 'X']]));
    expect(oldTerm.status).toBe(409);

    const notPdf = await uploadSchedule(student.token, Buffer.from('esto no es un pdf'));
    expect(notPdf.status).toBe(400);

    const emptyPdf = await uploadSchedule(student.token, buildPdf(['Hola mundo']));
    expect(notPdf.status).toBe(400);
    expect(emptyPdf.status).toBe(400);

    const huge = await uploadSchedule(
      student.token,
      Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024)]),
    );
    expect(huge.status).toBe(400);

    const noFile = await api.post(`${base}/schedule`).set(bearer(student.token));
    expect(noFile.status).toBe(400);

    const asTeacher = await api.get(`${base}/schedule/current`).set(bearer(teacherA.token));
    expect(asTeacher.status).toBe(403);
    const anonymous = await api.get(`${base}/schedule/current`);
    expect(anonymous.status).toBe(401);
  });

  it('restarts the courses every semester', async () => {
    const student = await registerStudent('6100000004', 'Estudiante Reinicio');
    await Database.execute('INSERT INTO enrollments (student_id, offering_id) VALUES ($1, $2)', [
      student.id,
      offerings.anterior,
    ]);

    const mine = await api.get(`${base}/enrollments/mine`).set(bearer(student.token));
    expect(mine.body.total).toBe(0);

    const publicList = await api.get(`${base}/offerings/public`).query({ page: 1, limit: 50 });
    const ids = publicList.body.payload.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(offerings.anterior);
    expect(ids).toContain(offerings.redes);

    const enroll = await api
      .post(`${base}/enrollments`)
      .set(bearer(student.token))
      .send({ offeringId: offerings.anterior });
    expect(enroll.status).toBe(409);

    const qr = await api.get(`${base}/polipoints/me/qr`).set(bearer(student.token));
    const scan = await api
      .post(`${base}/polipoints/scan`)
      .set(bearer(teacherA.token))
      .send({ token: qr.body.payload.token });
    expect(scan.body.payload.offerings).toHaveLength(0);
  });

  it('ranks classmates by polipoints and keeps the ranking private to the course', async () => {
    const ana = await registerStudent('6200000001', 'Ana Ranking');
    const beto = await registerStudent('6200000002', 'Beto Ranking');
    const carla = await registerStudent('6200000003', 'Carla Ranking');
    const outsider = await registerStudent('6200000004', 'Externo Ranking');
    const offeringId = offerings.redes;

    for (const student of [ana, beto, carla]) {
      await api.post(`${base}/enrollments`).set(bearer(student.token)).send({ offeringId });
    }

    const award = (studentId: string, points: number, key: string) =>
      api
        .post(`${base}/polipoints/awards`)
        .set(bearer(teacherA.token))
        .send({ studentId, offeringId, points, idempotencyKey: key });
    await award(ana.id, 30, 'rank-key-0001');
    await award(beto.id, 50, 'rank-key-0002');
    await award(carla.id, 30, 'rank-key-0003');
    await award(carla.id, -10, 'rank-key-0004');

    const ranking = await api
      .get(`${base}/offerings/${offeringId}/ranking`)
      .set(bearer(ana.token))
      .query({ page: 1, limit: 2 });
    expect(ranking.status).toBe(200);
    expect(ranking.body).toMatchObject({ page: 1, limit: 2 });
    expect(ranking.body.total).toBeGreaterThanOrEqual(3);
    expect(ranking.body.payload.entries).toHaveLength(2);
    expect(ranking.body.payload.entries[0]).toMatchObject({
      fullName: 'Beto Ranking',
      points: 50,
      rank: 1,
      isMe: false,
    });
    expect(ranking.body.payload.entries[0].cedula).toBeUndefined();
    expect(ranking.body.payload.me).toMatchObject({ fullName: 'Ana Ranking', points: 30, rank: 2, isMe: true });

    const full = await api
      .get(`${base}/offerings/${offeringId}/ranking`)
      .set(bearer(carla.token))
      .query({ page: 1, limit: 100 });
    const ordered = full.body.payload.entries.map((entry: { fullName: string; rank: number; points: number }) => [
      entry.fullName,
      entry.points,
      entry.rank,
    ]);
    expect(ordered).toContainEqual(['Beto Ranking', 50, 1]);
    expect(ordered).toContainEqual(['Ana Ranking', 30, 2]);
    expect(ordered).toContainEqual(['Carla Ranking', 20, 3]);
    expect(full.body.payload.me).toMatchObject({ points: 20, rank: 3 });

    const asOwner = await api
      .get(`${base}/offerings/${offeringId}/ranking`)
      .set(bearer(teacherA.token))
      .query({ page: 1, limit: 10 });
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.payload.me).toBeNull();

    const asOtherTeacher = await api.get(`${base}/offerings/${offeringId}/ranking`).set(bearer(teacherB.token));
    expect(asOtherTeacher.status).toBe(403);
    const asOutsider = await api.get(`${base}/offerings/${offeringId}/ranking`).set(bearer(outsider.token));
    expect(asOutsider.status).toBe(403);
    const missing = await api
      .get(`${base}/offerings/00000000-0000-4000-8000-000000000000/ranking`)
      .set(bearer(ana.token));
    expect(missing.status).toBe(404);
    const badLimit = await api
      .get(`${base}/offerings/${offeringId}/ranking`)
      .set(bearer(ana.token))
      .query({ limit: 500 });
    expect(badLimit.status).toBe(400);
  });
});
