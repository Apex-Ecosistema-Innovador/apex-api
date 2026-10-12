import Database from '../lib/database';
import { Queryable } from '../types/database';
import { Hackathon } from '../types/hackathon';

const HACKATHON_COLUMNS = `
  id,
  nombre,
  descripcion,
  modalidad,
  lugar,
  zona_horaria AS "zonaHoraria",
  cupo_maximo AS "cupoMaximo",
  equipo_min AS "equipoMin",
  equipo_max AS "equipoMax",
  fase_actual AS "faseActual",
  version_reglamento AS "versionReglamento",
  finalistas_por_categoria AS "finalistasPorCategoria",
  creado_en AS "creadoEn"
`;

class HackathonRepo {
  public static async buscarPorId(id: string): Promise<Hackathon | undefined> {
    const query = `SELECT ${HACKATHON_COLUMNS} FROM hackathones WHERE id = $1`;
    const rows = await Database.query<Hackathon>(query, [id], { queryId: 'HackathonRepo.buscarPorId' });
    return rows[0];
  }

  public static async buscarParaCompartir(id: string, executor: Queryable): Promise<Hackathon | undefined> {
    const query = `SELECT ${HACKATHON_COLUMNS} FROM hackathones WHERE id = $1 FOR SHARE`;
    const rows = await executor.query<Hackathon>(query, [id], { queryId: 'HackathonRepo.buscarParaCompartir' });
    return rows[0];
  }
}

export default HackathonRepo;
