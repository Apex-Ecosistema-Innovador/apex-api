import Database from '../lib/database';
import { RefreshToken } from '../types/models';

interface CreateRefreshTokenData {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

const TOKEN_COLUMNS = `
  id,
  user_id AS "userId",
  family_id AS "familyId",
  token_hash AS "tokenHash",
  expires_at AS "expiresAt",
  used_at AS "usedAt",
  revoked_at AS "revokedAt",
  created_at AS "createdAt"
`;

class RefreshTokenRepo {
  public static async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const query = `
      INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING ${TOKEN_COLUMNS}
    `;
    const parameters = [data.userId, data.familyId, data.tokenHash, data.expiresAt];
    const rows = await Database.query<RefreshToken>(query, parameters, { queryId: 'RefreshTokenRepo.create' });
    return rows[0];
  }

  public static async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const query = `SELECT ${TOKEN_COLUMNS} FROM refresh_tokens WHERE token_hash = $1`;
    const rows = await Database.query<RefreshToken>(query, [tokenHash], { queryId: 'RefreshTokenRepo.findByHash' });
    return rows[0];
  }

  public static async markUsed(id: string): Promise<RefreshToken | undefined> {
    const query = `
      UPDATE refresh_tokens
      SET used_at = now()
      WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
      RETURNING ${TOKEN_COLUMNS}
    `;
    const rows = await Database.query<RefreshToken>(query, [id], { queryId: 'RefreshTokenRepo.markUsed' });
    return rows[0];
  }

  public static async revokeFamily(familyId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE family_id = $1 AND revoked_at IS NULL
    `;
    await Database.execute(query, [familyId], { queryId: 'RefreshTokenRepo.revokeFamily' });
  }

  public static async revokeAllForUser(userId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    await Database.execute(query, [userId], { queryId: 'RefreshTokenRepo.revokeAllForUser' });
  }

  public static async deleteExpired(userId: string): Promise<void> {
    const query = `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now()`;
    await Database.execute(query, [userId], { queryId: 'RefreshTokenRepo.deleteExpired' });
  }
}

export default RefreshTokenRepo;
