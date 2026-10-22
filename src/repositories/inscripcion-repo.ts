import Database from '../lib/database';
import { Queryable } from '../types/database';
import { escapeLike } from '../lib/normalize';
import EstadoInscripcion from '../types/enums/estado-inscripcion';
import {
  CrearInscripcionData,
  FiltrosInscripciones,
  Inscripcion,
  InscripcionAdmin,
  ResumenInscripciones,
} from '../types/hackathon';
import { uuidV7 } from '../lib/uuid-v7';

const INSCRIPCION_COLUMNS = `
  id,
  usuario_id AS "usuarioId",
  hackathon_id AS "hackathonId",
  estado,
  institucion,
  programa,
  semestre,
  reglamento_version AS "reglamentoVersion",
  datos_version AS "datosVersion",
  aceptado_en AS "aceptadoEn",
  consiente_publicacion_imagen AS "consientePublicacionImagen",
  creado_en AS "creadoEn"
`;

const ADMIN_COLUMNS = `
  i.id,
  i.estado,
  i.creado_en AS "creadoEn",
  u.nombre,
  u.correo,
  u.correo_verificado_en AS "correoVerificadoEn",
  u.github,
  u.linkedin,
  u.portafolio,
  i.institucion,
  i.programa,
  i.semestre,
  COALESCE(i.tecnologias, '{}') AS tecnologias,
  i.nivel_experiencia AS "nivelExperiencia",
  i.consiente_publicacion_imagen AS "consientePublicacionImagen",
  i.reglamento_version AS "reglamentoVersion",
  i.datos_version AS "datosVersion",
  i.aceptado_en AS "aceptadoEn"
`;

const ADMIN_FILTERS = `
  WHERE ($1::uuid IS NULL OR i.hackathon_id = $1::uuid)
    AND ($2::estado_inscripcion IS NULL OR i.estado = $2::estado_inscripcion)
    AND ($3::boolean IS NULL OR (u.correo_verificado_en IS NOT NULL) = $3::boolean)
    AND (
      $4::text IS NULL
      OR lower(u.nombre) LIKE $4::text
      OR u.correo LIKE $4::text
      OR lower(i.institucion) LIKE $4::text
      OR lower(i.programa) LIKE $4::text
    )
`;

class InscripcionRepo {
  public static async crear(data: CrearInscripcionData, executor: Queryable = Database): Promise<Inscripcion> {
    const query = `
      INSERT INTO inscripciones (
        id, usuario_id, hackathon_id, institucion, programa, semestre,
        reglamento_version, datos_version, aceptado_en, consiente_publicacion_imagen
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
      RETURNING ${INSCRIPCION_COLUMNS}
    `;
    const parameters = [
      uuidV7(),
      data.usuarioId,
      data.hackathonId,
      data.institucion,
      data.programa,
      data.semestre,
      data.reglamentoVersion,
      data.datosVersion,
      data.consientePublicacionImagen,
    ];
    const rows = await executor.query<Inscripcion>(query, parameters, { queryId: 'InscripcionRepo.crear' });
    return rows[0];
  }

  public static async buscarPorUsuarioYEvento(
    usuarioId: string,
    hackathonId: string,
  ): Promise<Inscripcion | undefined> {
    const query = `
      SELECT ${INSCRIPCION_COLUMNS}
      FROM inscripciones
      WHERE usuario_id = $1 AND hackathon_id = $2
    `;
    const rows = await Database.query<Inscripcion>(query, [usuarioId, hackathonId], {
      queryId: 'InscripcionRepo.buscarPorUsuarioYEvento',
    });
    return rows[0];
  }

  public static async listarParaAdmin(filtros: FiltrosInscripciones, page: number, limit: number) {
    const like = filtros.q ? `%${escapeLike(filtros.q.toLowerCase())}%` : null;
    const filterParameters = [filtros.hackathonId ?? null, filtros.estado ?? null, filtros.verificado ?? null, like];
    const rowsQuery = `
      SELECT ${ADMIN_COLUMNS}
      FROM inscripciones i
      JOIN usuarios u ON u.id = i.usuario_id
      ${ADMIN_FILTERS}
      ORDER BY i.creado_en DESC
      LIMIT $5 OFFSET $6
    `;
    const countQuery = `
      SELECT count(*)::int AS total
      FROM inscripciones i
      JOIN usuarios u ON u.id = i.usuario_id
      ${ADMIN_FILTERS}
    `;

    const [rows, totals] = await Promise.all([
      Database.query<InscripcionAdmin>(rowsQuery, [...filterParameters, limit, (page - 1) * limit], {
        queryId: 'InscripcionRepo.listarParaAdmin',
      }),
      Database.query<{ total: number }>(countQuery, filterParameters, {
        queryId: 'InscripcionRepo.listarParaAdmin.count',
      }),
    ]);

    return { rows, total: totals[0].total };
  }

  public static async resumen(hackathonId: string | undefined): Promise<ResumenInscripciones> {
    const query = `
      SELECT i.estado, count(*)::int AS total, count(u.correo_verificado_en)::int AS verificadas
      FROM inscripciones i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE ($1::uuid IS NULL OR i.hackathon_id = $1::uuid)
      GROUP BY i.estado
    `;
    const rows = await Database.query<{ estado: EstadoInscripcion; total: number; verificadas: number }>(
      query,
      [hackathonId ?? null],
      { queryId: 'InscripcionRepo.resumen' },
    );

    const porEstado = Object.fromEntries(Object.values(EstadoInscripcion).map((estado) => [estado, 0])) as Record<
      EstadoInscripcion,
      number
    >;
    rows.forEach((row) => {
      porEstado[row.estado] = row.total;
    });
    return {
      total: rows.reduce((sum, row) => sum + row.total, 0),
      verificadas: rows.reduce((sum, row) => sum + row.verificadas, 0),
      porEstado,
    };
  }
}

export default InscripcionRepo;
