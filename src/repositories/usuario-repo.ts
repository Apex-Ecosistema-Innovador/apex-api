import Database from '../lib/database';
import { Queryable } from '../types/database';
import { CrearUsuarioData, Usuario } from '../types/hackathon';
import { uuidV7 } from '../lib/uuid-v7';

const USUARIO_COLUMNS = `
  id,
  correo,
  hash_contrasena AS "hashContrasena",
  nombre,
  github,
  linkedin,
  portafolio,
  estado,
  correo_verificado_en AS "correoVerificadoEn",
  creado_en AS "creadoEn",
  actualizado_en AS "actualizadoEn"
`;

class UsuarioRepo {
  public static async crear(data: CrearUsuarioData, executor: Queryable = Database): Promise<Usuario> {
    const query = `
      INSERT INTO usuarios (id, correo, hash_contrasena, nombre, github, linkedin, portafolio)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${USUARIO_COLUMNS}
    `;
    const parameters = [
      uuidV7(),
      data.correo,
      data.hashContrasena,
      data.nombre,
      data.github ?? null,
      data.linkedin ?? null,
      data.portafolio ?? null,
    ];
    const rows = await executor.query<Usuario>(query, parameters, { queryId: 'UsuarioRepo.crear' });
    return rows[0];
  }

  public static async buscarPorCorreo(correo: string): Promise<Usuario | undefined> {
    const query = `SELECT ${USUARIO_COLUMNS} FROM usuarios WHERE lower(correo) = lower($1)`;
    const rows = await Database.query<Usuario>(query, [correo], { queryId: 'UsuarioRepo.buscarPorCorreo' });
    return rows[0];
  }

  public static async marcarCorreoVerificado(usuarioId: string, executor: Queryable = Database): Promise<void> {
    const query = `
      UPDATE usuarios
      SET correo_verificado_en = COALESCE(correo_verificado_en, now()), actualizado_en = now()
      WHERE id = $1
    `;
    await executor.execute(query, [usuarioId], { queryId: 'UsuarioRepo.marcarCorreoVerificado' });
  }
}

export default UsuarioRepo;
