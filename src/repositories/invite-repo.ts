import { Knex } from 'knex';
import database from '../lib/database';

interface Invite {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  expires_at: Date;
}

class InviteRepo {
  public static async create(code: string, createdBy: string, expiresAt: Date): Promise<Invite> {
    const [invite] = await database<Invite>('teacher_invites')
      .insert({ code, created_by: createdBy, expires_at: expiresAt })
      .returning('*');
    return invite;
  }

  public static async consume(code: string, userId: string, trx: Knex.Transaction): Promise<boolean> {
    const updated = await trx<Invite>('teacher_invites')
      .where({ code })
      .whereNull('used_by')
      .where('expires_at', '>', trx.fn.now())
      .update({ used_by: userId });
    return updated > 0;
  }

  public static async isValid(code: string, trx: Knex.Transaction): Promise<boolean> {
    const invite = await trx<Invite>('teacher_invites')
      .where({ code })
      .whereNull('used_by')
      .where('expires_at', '>', trx.fn.now())
      .first();
    return Boolean(invite);
  }
}

export default InviteRepo;
