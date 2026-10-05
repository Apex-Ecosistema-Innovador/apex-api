import database from '../lib/database';
import { RefreshToken } from '../types/models';

interface CreateRefreshTokenData {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

class RefreshTokenRepo {
  public static async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const [token] = await database<RefreshToken>('refresh_tokens')
      .insert({
        user_id: data.userId,
        family_id: data.familyId,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt,
      })
      .returning('*');
    return token;
  }

  public static async findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    return database<RefreshToken>('refresh_tokens').where({ token_hash: tokenHash }).first();
  }

  public static async markUsed(id: string): Promise<RefreshToken | undefined> {
    const [token] = await database<RefreshToken>('refresh_tokens')
      .where({ id })
      .whereNull('used_at')
      .whereNull('revoked_at')
      .update({ used_at: database.fn.now() })
      .returning('*');
    return token;
  }

  public static async revokeFamily(familyId: string): Promise<void> {
    await database('refresh_tokens')
      .where({ family_id: familyId })
      .whereNull('revoked_at')
      .update({ revoked_at: database.fn.now() });
  }

  public static async revokeAllForUser(userId: string): Promise<void> {
    await database('refresh_tokens')
      .where({ user_id: userId })
      .whereNull('revoked_at')
      .update({ revoked_at: database.fn.now() });
  }

  public static async deleteExpired(userId: string): Promise<void> {
    await database('refresh_tokens').where({ user_id: userId }).where('expires_at', '<', database.fn.now()).delete();
  }
}

export default RefreshTokenRepo;
