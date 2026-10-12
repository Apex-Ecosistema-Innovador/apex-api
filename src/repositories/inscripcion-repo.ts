import Database from '../lib/database';
import { Queryable } from '../types/database';
import { CrearInscripcionData, Inscripcion } from '../types/hackathon';
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
}

export default InscripcionRepo;
