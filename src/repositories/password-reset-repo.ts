import database from '../lib/database';
import { PasswordResetToken } from '../types/models';

class PasswordResetRepo {
  public static async create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [token] = await database<PasswordResetToken>('password_reset_tokens')
      .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
      .returning('*');
    return token;
  }

  public static async findByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    return database<PasswordResetToken>('password_reset_tokens').where({ token_hash: tokenHash }).first();
  }

  public static async latestForUser(userId: string): Promise<PasswordResetToken | undefined> {
    return database<PasswordResetToken>('password_reset_tokens')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
  }

  public static async consume(id: string): Promise<boolean> {
    const updated = await database('password_reset_tokens')
      .where({ id })
      .whereNull('used_at')
      .where('expires_at', '>', database.fn.now())
      .update({ used_at: database.fn.now() });
    return updated === 1;
  }

  public static async invalidateForUser(userId: string): Promise<void> {
    await database('password_reset_tokens')
      .where({ user_id: userId })
      .whereNull('used_at')
      .update({ used_at: database.fn.now() });
  }
}

export default PasswordResetRepo;
