import Database from '../lib/database';
import { PasswordResetToken } from '../types/models';

const TOKEN_COLUMNS = `
  id,
  user_id AS "userId",
  token_hash AS "tokenHash",
  expires_at AS "expiresAt",
  used_at AS "usedAt",
  created_at AS "createdAt"
`;

class PasswordResetRepo {
  public static async create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetToken> {
    const query = `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING ${TOKEN_COLUMNS}
    `;
    const rows = await Database.query<PasswordResetToken>(query, [userId, tokenHash, expiresAt], {
      queryId: 'PasswordResetRepo.create',
    });
    return rows[0];
  }

  public static async findByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const query = `SELECT ${TOKEN_COLUMNS} FROM password_reset_tokens WHERE token_hash = $1`;
    const rows = await Database.query<PasswordResetToken>(query, [tokenHash], {
      queryId: 'PasswordResetRepo.findByHash',
    });
    return rows[0];
  }

  public static async latestForUser(userId: string): Promise<PasswordResetToken | undefined> {
    const query = `
      SELECT ${TOKEN_COLUMNS}
      FROM password_reset_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const rows = await Database.query<PasswordResetToken>(query, [userId], {
      queryId: 'PasswordResetRepo.latestForUser',
    });
    return rows[0];
  }

  public static async consume(id: string): Promise<boolean> {
    const query = `
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE id = $1 AND used_at IS NULL AND expires_at > now()
    `;
    const updated = await Database.execute(query, [id], { queryId: 'PasswordResetRepo.consume' });
    return updated === 1;
  }

  public static async invalidateForUser(userId: string): Promise<void> {
    const query = `
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE user_id = $1 AND used_at IS NULL
    `;
    await Database.execute(query, [userId], { queryId: 'PasswordResetRepo.invalidateForUser' });
  }
}

export default PasswordResetRepo;
