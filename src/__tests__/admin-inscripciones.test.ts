import request from 'supertest';
import server from '../server';
import Database from '../lib/database';
import { insertHackathon, insertUser, resetDatabase } from './reset-database';

const api = request(server.app);
const base = '/api/v1';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const login = async (cedula: string) => {
  const res = await api.post(`${base}/auth/login`).send({ identifier: cedula, password: 'password123' });
  return res.body.payload.accessToken as string;
};

const inscribir = (eventoId: string, nombre: string, correo: string, institucion: string) =>
  api.post(`${base}/eventos/${eventoId}/inscripciones`).send({
    nombre,
    correo,
    contrasena: 'clave-segura-1',
    institucion,
    programa: 'Ingeniería Informática',
    semestre: 4,
    versionReglamento: '1.0',
    aceptaReglamento: true,
    versionDatos: '1.0',
    autorizaTratamientoDatos: true,
  });

describe('hackathon registrations for admins', () => {
  let eventoId: string;
  let superAdmin: string;

  beforeAll(async () => {
    await resetDatabase();
    eventoId = await insertHackathon();
    await insertUser('1000000000', 'Super Admin', 'super_admin');
    await insertUser('1000000001', 'Admin Uno', 'admin');
    await insertUser('1000000002', 'Profe Uno', 'teacher');
    superAdmin = await login('1000000000');

    expect((await inscribir(eventoId, 'Ana María Gómez', 'ana.gomez@elpoli.edu.co', 'Politécnico')).status).toBe(201);
    expect((await inscribir(eventoId, 'Luis Pérez', 'luis.perez@elpoli.edu.co', 'Universidad Nacional')).status).toBe(201);
    await Database.execute(`UPDATE usuarios SET correo_verificado_en = now() WHERE correo = 'ana.gomez@elpoli.edu.co'`, [], {
      queryId: 'test.verificarCorreo',
    });
  });

  afterAll(async () => {
    await Database.close();
  });

  it('lists registrations with the participant data and never the password hash', async () => {
    const res = await api.get(`${base}/admin/hackathon/inscripciones`).set(bearer(superAdmin));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const ana = res.body.payload.find((row: { correo: string }) => row.correo === 'ana.gomez@elpoli.edu.co');
    expect(ana).toMatchObject({
      nombre: 'Ana María Gómez',
      estado: 'PENDIENTE',
      institucion: 'Politécnico',
      semestre: 4,
      tecnologias: [],
    });
    expect(ana.correoVerificadoEn).not.toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/hash|clave-segura/i);
  });

  it('filters by search, verification and state', async () => {
    const search = await api.get(`${base}/admin/hackathon/inscripciones?q=nacional`).set(bearer(superAdmin));
    expect(search.body.payload.map((row: { nombre: string }) => row.nombre)).toEqual(['Luis Pérez']);

    const unverified = await api.get(`${base}/admin/hackathon/inscripciones?verificado=false`).set(bearer(superAdmin));
    expect(unverified.body.total).toBe(1);

    const approved = await api.get(`${base}/admin/hackathon/inscripciones?estado=APROBADA`).set(bearer(superAdmin));
    expect(approved.body.total).toBe(0);
  });

  it('summarises registrations', async () => {
    const res = await api.get(`${base}/admin/hackathon/inscripciones/resumen`).set(bearer(superAdmin));

    expect(res.status).toBe(200);
    expect(res.body.payload).toEqual({
      total: 2,
      verificadas: 1,
      porEstado: { PENDIENTE: 2, APROBADA: 0, RECHAZADA: 0, EN_LISTA_ESPERA: 0 },
    });
  });

  it('is restricted to the super admin', async () => {
    const admin = await login('1000000001');
    const teacher = await login('1000000002');

    for (const token of [admin, teacher]) {
      const res = await api.get(`${base}/admin/hackathon/inscripciones`).set(bearer(token));
      expect(res.status).toBe(403);
    }
    expect((await api.get(`${base}/admin/hackathon/inscripciones`)).status).toBe(401);
  });
});
