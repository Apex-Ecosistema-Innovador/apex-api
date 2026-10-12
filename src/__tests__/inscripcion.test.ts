import request from 'supertest';
import server from '../server';
import Database from '../lib/database';
import { mailer, MemoryTransport } from '../lib/mailer';
import { uuidV7 } from '../lib/uuid-v7';
import { insertHackathon, resetDatabase } from './reset-database';

const api = request(server.app);
const base = '/api/v1';
const outbox = (mailer as MemoryTransport).outbox;

const solicitud = (overrides: Record<string, unknown> = {}) => ({
  nombre: 'Ana María Gómez',
  correo: 'ana.gomez@elpoli.edu.co',
  contrasena: 'clave-segura-1',
  institucion: 'Politécnico Colombiano Jaime Isaza Cadavid',
  programa: 'Ingeniería Informática',
  semestre: 4,
  versionReglamento: '1.0',
  aceptaReglamento: true,
  versionDatos: '1.0',
  autorizaTratamientoDatos: true,
  ...overrides,
});

const tokenDelCorreo = (indice = 0) => outbox[indice].text.match(/#token=([\w-]+)/)![1];

const esperarCorreos = async (cantidad: number) => {
  for (let intento = 0; intento < 40 && outbox.length < cantidad; intento += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

afterAll(async () => {
  await Database.close();
});

describe('inscripción a la hackathon', () => {
  let eventoId: string;

  beforeEach(async () => {
    await resetDatabase();
    outbox.length = 0;
    eventoId = await insertHackathon();
  });

  const inscribir = (cuerpo: Record<string, unknown> = solicitud(), id = eventoId) =>
    api.post(`${base}/eventos/${id}/inscripciones`).send(cuerpo);

  it('crea la cuenta y deja la inscripción en PENDIENTE con el correo sin verificar', async () => {
    const respuesta = await inscribir();

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.payload).toEqual({
      inscripcionId: expect.any(String),
      estado: 'PENDIENTE',
      correoVerificado: false,
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/hash|contrasena|clave-segura/i);

    const [usuario] = await Database.query<{
      correo: string;
      hash_contrasena: string;
      correo_verificado_en: Date | null;
    }>('SELECT correo, hash_contrasena, correo_verificado_en FROM usuarios');
    expect(usuario.correo).toBe('ana.gomez@elpoli.edu.co');
    expect(usuario.hash_contrasena).toMatch(/^\$argon2id\$/);
    expect(usuario.correo_verificado_en).toBeNull();
  });

  it('guarda los datos de contexto de la inscripción sin pedir campos no solicitados', async () => {
    await inscribir();

    const [inscripcion] = await Database.query<Record<string, unknown>>('SELECT * FROM inscripciones');
    expect(inscripcion).toMatchObject({
      estado: 'PENDIENTE',
      institucion: 'Politécnico Colombiano Jaime Isaza Cadavid',
      programa: 'Ingeniería Informática',
      semestre: 4,
      tecnologias: null,
      nivel_experiencia: null,
      consiente_publicacion_imagen: false,
    });
    expect(Object.keys(inscripcion)).not.toEqual(expect.arrayContaining(['cedula', 'documento', 'ciudad']));
  });

  it('usa identificadores UUID versión 7 y la hora del servidor al aceptar', async () => {
    await inscribir();

    const [fila] = await Database.query<{ id: string; usuario_id: string; aceptado_en: Date }>(
      'SELECT id, usuario_id, aceptado_en FROM inscripciones',
    );
    expect(fila.id[14]).toBe('7');
    expect(fila.usuario_id[14]).toBe('7');
    expect(Math.abs(fila.aceptado_en.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it('registra qué versión del reglamento y de la autorización de datos aceptó la persona', async () => {
    await inscribir();

    const [inscripcion] = await Database.query<{ reglamento_version: string; datos_version: string }>(
      'SELECT reglamento_version, datos_version FROM inscripciones',
    );
    expect(inscripcion).toEqual({ reglamento_version: '1.0', datos_version: '1.0' });
  });

  it('guarda el consentimiento de imagen de forma independiente de la autorización de datos', async () => {
    await inscribir(solicitud({ consientePublicacionImagen: true }));

    const [inscripcion] = await Database.query<{ consiente_publicacion_imagen: boolean }>(
      'SELECT consiente_publicacion_imagen FROM inscripciones',
    );
    expect(inscripcion.consiente_publicacion_imagen).toBe(true);
  });

  it('envía el correo de verificación con un enlace de un solo uso y guarda solo su hash', async () => {
    await inscribir();
    await esperarCorreos(1);

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('ana.gomez@elpoli.edu.co');
    expect(outbox[0].text).toContain('/hackathon/verificar-correo#token=');
    expect(outbox[0].html).toContain('Hackathon');

    const token = tokenDelCorreo();
    const filas = await Database.query('SELECT * FROM tokens_usuario');
    expect(JSON.stringify(filas)).not.toContain(token);
    expect(filas).toHaveLength(1);
  });

  it('rechaza un correo que no es institucional', async () => {
    const respuesta = await inscribir(solicitud({ correo: 'ana@gmail.com' }));

    expect(respuesta.status).toBe(400);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('exige aceptar el reglamento y autorizar el tratamiento de datos por separado', async () => {
    const sinReglamento = await inscribir(solicitud({ aceptaReglamento: false }));
    const sinAutorizacion = await inscribir(solicitud({ autorizaTratamientoDatos: false }));
    const omitida = await inscribir(solicitud({ autorizaTratamientoDatos: undefined }));

    expect([sinReglamento.status, sinAutorizacion.status, omitida.status]).toEqual([400, 400, 400]);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('rechaza datos con formato inválido', async () => {
    const invalidos = [
      { contrasena: 'corta' },
      { nombre: 'Ana 2' },
      { nombre: 'A' },
      { semestre: 0 },
      { semestre: 13 },
      { semestre: 2.5 },
      { semestre: '4' },
      { github: 'https://github.com/ana' },
      { github: '-ana' },
      { linkedin: 'https://example.com/in/ana' },
      { linkedin: 'http://linkedin.com/in/ana' },
      { portafolio: 'http://ana.dev' },
      { portafolio: 'javascript:alert(1)' },
      { institucion: ' ' },
      { programa: 'x' },
    ];

    for (const campo of invalidos) {
      const respuesta = await inscribir(solicitud(campo));
      expect([JSON.stringify(campo), respuesta.status]).toEqual([JSON.stringify(campo), 400]);
    }
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('acepta el perfil opcional y trata los textos vacíos como ausentes', async () => {
    const completo = await inscribir(
      solicitud({
        github: 'ana-gomez',
        linkedin: 'https://www.linkedin.com/in/ana-gomez',
        portafolio: 'https://ana.dev',
      }),
    );
    expect(completo.status).toBe(201);

    const vacio = await inscribir(
      solicitud({ correo: 'beto@elpoli.edu.co', github: '', linkedin: '', portafolio: '' }),
    );
    expect(vacio.status).toBe(201);

    const filas = await Database.query<{ correo: string; github: string | null; linkedin: string | null }>(
      'SELECT correo, github, linkedin FROM usuarios ORDER BY correo',
    );
    expect(filas).toEqual([
      { correo: 'ana.gomez@elpoli.edu.co', github: 'ana-gomez', linkedin: 'https://www.linkedin.com/in/ana-gomez' },
      { correo: 'beto@elpoli.edu.co', github: null, linkedin: null },
    ]);
  });

  it('rechaza el registro cuando el evento no está en la fase de inscripciones', async () => {
    const cerrado = await insertHackathon({ faseActual: 'EQUIPOS' });
    const respuesta = await inscribir(solicitud(), cerrado);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.message).toMatch(/inscripciones no están abiertas/);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('no expone los eventos en borrador ni los cancelados', async () => {
    const borrador = await insertHackathon({ faseActual: 'BORRADOR' });
    const cancelado = await insertHackathon({ faseActual: 'CANCELADO' });

    for (const id of [borrador, cancelado, uuidV7()]) {
      expect((await api.get(`${base}/eventos/${id}`)).status).toBe(404);
      expect((await inscribir(solicitud(), id)).status).toBe(404);
    }
    expect((await api.get(`${base}/eventos/no-es-uuid`)).status).toBe(400);
  });

  it('rechaza una versión de reglamento distinta a la vigente', async () => {
    const respuesta = await inscribir(solicitud({ versionReglamento: '0.9' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.message).toMatch(/reglamento cambió/);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('rechaza una versión de autorización de datos distinta a la vigente', async () => {
    const respuesta = await inscribir(solicitud({ versionDatos: '0.1' }));

    expect(respuesta.status).toBe(409);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(0);
  });

  it('no permite dos cuentas con el mismo correo aunque cambien las mayúsculas', async () => {
    expect((await inscribir()).status).toBe(201);
    const repetida = await inscribir(solicitud({ correo: 'ANA.GOMEZ@ELPOLI.EDU.CO' }));

    expect(repetida.status).toBe(409);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(1);
    expect(await Database.query('SELECT 1 FROM inscripciones')).toHaveLength(1);
  });

  it('deja una sola cuenta cuando dos solicitudes con el mismo correo llegan a la vez', async () => {
    const [primera, segunda] = await Promise.all([inscribir(), inscribir()]);

    expect([primera.status, segunda.status].sort()).toEqual([201, 409]);
    expect(await Database.query('SELECT 1 FROM usuarios')).toHaveLength(1);
    expect(await Database.query('SELECT 1 FROM inscripciones')).toHaveLength(1);
    expect(await Database.query('SELECT 1 FROM tokens_usuario')).toHaveLength(1);
  });

  it('la base de datos impide dos inscripciones de la misma persona al mismo evento', async () => {
    await inscribir();
    const [fila] = await Database.query<{ usuario_id: string }>('SELECT usuario_id FROM inscripciones');

    await expect(
      Database.execute(
        `INSERT INTO inscripciones (id, usuario_id, hackathon_id, institucion, programa, semestre, reglamento_version, datos_version)
         VALUES ($1, $2, $3, 'x', 'y', 1, '1.0', '1.0')`,
        [uuidV7(), fila.usuario_id, eventoId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('la base de datos impide un correo que solo difiere en mayúsculas', async () => {
    await inscribir();

    await expect(
      Database.execute(
        `INSERT INTO usuarios (id, correo, hash_contrasena, nombre) VALUES ($1, 'Ana.Gomez@elpoli.edu.co', 'x', 'Ana')`,
        [uuidV7()],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('muestra los datos públicos del evento y la versión del reglamento sin exponer datos internos', async () => {
    const respuesta = await api.get(`${base}/eventos/${eventoId}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.payload).toEqual({
      id: eventoId,
      nombre: 'Hackathon de prueba',
      descripcion: '',
      modalidad: 'PRESENCIAL',
      lugar: '',
      zonaHoraria: 'America/Bogota',
      equipoMin: 2,
      equipoMax: 4,
      faseActual: 'INSCRIPCIONES',
      inscripcionesAbiertas: true,
      versionReglamento: '1.0',
      versionAutorizacionDatos: '1.0',
    });
  });

  it('indica que las inscripciones están cerradas cuando el evento avanza de fase', async () => {
    const cerrado = await insertHackathon({ faseActual: 'DESARROLLO' });
    const respuesta = await api.get(`${base}/eventos/${cerrado}`);

    expect(respuesta.body.payload.inscripcionesAbiertas).toBe(false);
  });
});

describe('verificación del correo', () => {
  let eventoId: string;

  beforeEach(async () => {
    await resetDatabase();
    outbox.length = 0;
    eventoId = await insertHackathon();
    await api.post(`${base}/eventos/${eventoId}/inscripciones`).send(solicitud());
    await esperarCorreos(1);
  });

  const verificar = (token: string) => api.post(`${base}/verificacion-correo`).send({ token });
  const reenviar = (correo = 'ana.gomez@elpoli.edu.co') =>
    api.post(`${base}/verificacion-correo/reenvio`).send({ correo });
  const rejuvenecerTokens = () =>
    Database.execute("UPDATE tokens_usuario SET creado_en = now() - interval '5 minutes'");

  it('marca el correo como verificado con el enlace recibido', async () => {
    const respuesta = await verificar(tokenDelCorreo());

    expect(respuesta.status).toBe(200);
    const [usuario] = await Database.query<{ correo_verificado_en: Date | null }>(
      'SELECT correo_verificado_en FROM usuarios',
    );
    expect(usuario.correo_verificado_en).not.toBeNull();
  });

  it('no permite usar dos veces el mismo enlace', async () => {
    const token = tokenDelCorreo();
    expect((await verificar(token)).status).toBe(200);

    expect((await verificar(token)).status).toBe(400);
  });

  it('rechaza enlaces desconocidos y enlaces vencidos', async () => {
    const token = tokenDelCorreo();
    await Database.execute("UPDATE tokens_usuario SET expira_en = now() - interval '1 second'");

    expect((await verificar(token)).status).toBe(400);
    expect((await verificar('x'.repeat(40))).status).toBe(400);
    expect((await verificar('corto')).status).toBe(400);
    const [usuario] = await Database.query<{ correo_verificado_en: Date | null }>(
      'SELECT correo_verificado_en FROM usuarios',
    );
    expect(usuario.correo_verificado_en).toBeNull();
  });

  it('con dos solicitudes simultáneas del mismo enlace solo una tiene éxito', async () => {
    const token = tokenDelCorreo();
    const [primera, segunda] = await Promise.all([verificar(token), verificar(token)]);

    expect([primera.status, segunda.status].sort()).toEqual([200, 400]);
  });

  it('reenvía un enlace nuevo e invalida el anterior', async () => {
    const anterior = tokenDelCorreo();
    await rejuvenecerTokens();

    expect((await reenviar()).status).toBe(200);
    await esperarCorreos(2);

    expect(outbox).toHaveLength(2);
    expect((await verificar(anterior)).status).toBe(400);
    expect((await verificar(tokenDelCorreo(1))).status).toBe(200);
  });

  it('no reenvía un enlace durante el tiempo de espera', async () => {
    await reenviar();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(outbox).toHaveLength(1);
  });

  it('responde igual aunque el correo no exista y no envía nada', async () => {
    const desconocido = await reenviar('nadie@elpoli.edu.co');
    const conocido = await reenviar();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(desconocido.status).toBe(200);
    expect(desconocido.body.message).toBe(conocido.body.message);
    expect(outbox).toHaveLength(1);
  });

  it('no reenvía el enlace a una cuenta que ya verificó su correo', async () => {
    await verificar(tokenDelCorreo());
    await rejuvenecerTokens();
    await reenviar();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(outbox).toHaveLength(1);
  });
});

describe('identificadores UUID versión 7', () => {
  it('llevan la versión 7, la variante RFC 4122 y se ordenan por tiempo', () => {
    const antes = uuidV7(1_700_000_000_000);
    const despues = uuidV7(1_700_000_001_000);

    expect(antes).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(antes < despues).toBe(true);
  });
});
