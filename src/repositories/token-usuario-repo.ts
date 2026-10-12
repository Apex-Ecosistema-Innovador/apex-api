import Database from '../lib/database';
import { Queryable } from '../types/database';
import TipoTokenUsuario from '../types/enums/tipo-token-usuario';
import { TokenUsuario } from '../types/hackathon';
import { uuidV7 } from '../lib/uuid-v7';

const TOKEN_COLUMNS = `
  id,
  usuario_id AS "usuarioId",
  tipo,
  hash_token AS "hashToken",
  expira_en AS "expiraEn",
  usado_en AS "usadoEn",
  creado_en AS "creadoEn"
`;

class TokenUsuarioRepo {
  public static async crear(
    usuarioId: string,
    tipo: TipoTokenUsuario,
    hashToken: string,
    expiraEn: Date,
    executor: Queryable = Database,
  ): Promise<TokenUsuario> {
    const query = `
      INSERT INTO tokens_usuario (id, usuario_id, tipo, hash_token, expira_en)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${TOKEN_COLUMNS}
    `;
    const rows = await executor.query<TokenUsuario>(query, [uuidV7(), usuarioId, tipo, hashToken, expiraEn], {
      queryId: 'TokenUsuarioRepo.crear',
    });
    return rows[0];
  }

  public static async consumir(
    hashToken: string,
    tipo: TipoTokenUsuario,
    executor: Queryable = Database,
  ): Promise<string | undefined> {
    const query = `
      UPDATE tokens_usuario
      SET usado_en = now()
      WHERE hash_token = $1 AND tipo = $2 AND usado_en IS NULL AND expira_en > now()
      RETURNING usuario_id AS "usuarioId"
    `;
    const rows = await executor.query<{ usuarioId: string }>(query, [hashToken, tipo], {
      queryId: 'TokenUsuarioRepo.consumir',
    });
    return rows[0]?.usuarioId;
  }

  public static async ultimoDeUsuario(usuarioId: string, tipo: TipoTokenUsuario): Promise<TokenUsuario | undefined> {
    const query = `
      SELECT ${TOKEN_COLUMNS}
      FROM tokens_usuario
      WHERE usuario_id = $1 AND tipo = $2
      ORDER BY creado_en DESC
      LIMIT 1
    `;
    const rows = await Database.query<TokenUsuario>(query, [usuarioId, tipo], {
      queryId: 'TokenUsuarioRepo.ultimoDeUsuario',
    });
    return rows[0];
  }

  public static async invalidarPendientes(usuarioId: string, tipo: TipoTokenUsuario): Promise<void> {
    const query = `
      UPDATE tokens_usuario
      SET usado_en = now()
      WHERE usuario_id = $1 AND tipo = $2 AND usado_en IS NULL
    `;
    await Database.execute(query, [usuarioId, tipo], { queryId: 'TokenUsuarioRepo.invalidarPendientes' });
  }
}

export default TokenUsuarioRepo;
